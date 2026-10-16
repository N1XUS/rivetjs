using Grpc.Core;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc.Filters;
using Markdig;
using Rivet.Bench;
using System.Diagnostics;

namespace Rivet.ContentSite;

/// <summary>Aggregates completed request phase times without per-request logging.</summary>
public sealed class FrontendCounters { public long Completed, Failed, Cancelled; public double RpcMs, ParseMs, RenderMs; public readonly object Sync = new(); }
/// <summary>Supplies RPC data and already parsed trusted fixture HTML to the Razor template.</summary>
public sealed record PageModel(Page Page, IHtmlContent Article);

/// <summary>Renders the shared fixture and exposes its public article DTO over REST.</summary>
public sealed class HomeController(Content.ContentClient client, FrontendCounters counters) : Controller {
    /// <summary>Fetches one native gRPC response and renders it using production Razor.</summary>
    [HttpGet("/page")]
    public async Task<IActionResult> Page([FromQuery] string? rows, [FromQuery] string? token, [FromQuery] string? article, [FromQuery(Name="delay_ms")] string? delayMs, [FromQuery] string? strings) {
        if(!int.TryParse(rows ?? "100", out var count) || count < 0 || count > 5000 || !int.TryParse(delayMs ?? "0",out var delay) || delay < 0 || delay > 5000 || (token?.Length ?? 0) > 512) return BadRequest();
        try {
            var started = Stopwatch.GetTimestamp();
            var page = await client.GetPageAsync(new PageRequest {Rows=count,Token=token ?? "",Article=article == "1",DelayMs=delay,Strings=strings == "1" ? 1 : strings == "2" ? 2 : 0}, deadline:DateTime.UtcNow.AddSeconds(15),cancellationToken:HttpContext.RequestAborted);
            var rpc = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            started = Stopwatch.GetTimestamp();
            var html = page.Markdown.Length == 0 ? "" : Markdown.ToHtml(page.Markdown);
            var parse = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            lock(counters.Sync) { counters.RpcMs += rpc; counters.ParseMs += parse; }
            HttpContext.Items["renderStart"] = Stopwatch.GetTimestamp();
            return View("Page",new PageModel(page,new HtmlString(html)));
        } catch(RpcException e) when(e.StatusCode == Grpc.Core.StatusCode.Cancelled || HttpContext.RequestAborted.IsCancellationRequested) { Interlocked.Increment(ref counters.Cancelled); return StatusCode(499); }
          catch(RpcException) { Interlocked.Increment(ref counters.Failed); return StatusCode(502); }
    }
    /// <summary>Returns a public article DTO using the same reused server gRPC client.</summary>
    [HttpGet("/api/articles/{id}")]
    public async Task<IActionResult> Article(string id) {
        if(id != "performance") return NotFound();
        try {
            var page = await client.GetPageAsync(new PageRequest {Article=true},deadline:DateTime.UtcNow.AddSeconds(15),cancellationToken:HttpContext.RequestAborted);
            return Json(new {id,markdown=page.Markdown});
        } catch(RpcException) { return StatusCode(502); }
    }
}

/// <summary>Records Razor result execution including writer wait time.</summary>
public sealed class RenderTimingFilter(FrontendCounters counters) : IAsyncResultFilter {
    /// <summary>Times the result pipeline after RPC and Markdown processing have completed.</summary>
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next) {
        var result = await next();
        if(context.HttpContext.Items["renderStart"] is long started) {
            if(result.Exception is null && !context.HttpContext.RequestAborted.IsCancellationRequested) {
                Interlocked.Increment(ref counters.Completed);
                lock(counters.Sync) counters.RenderMs += Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            } else Interlocked.Increment(ref counters.Failed);
        }
    }
}
