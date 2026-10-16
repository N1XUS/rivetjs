using System.Globalization;
using Grpc.Core;
using Rivet.Bench;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.WebHost.ConfigureKestrel(options => {
    options.ListenAnyIP(8080, listener => listener.Protocols = HttpProtocols.Http1);
    options.ListenAnyIP(8081, listener => listener.Protocols = HttpProtocols.Http2);
});
builder.Services.AddGrpc();
builder.Services.AddSingleton<BackendCounters>();
var app = builder.Build();
app.MapGrpcService<FixtureService>();
app.MapGet("/health", () => Results.Ok(new { status = "ready" }));
app.MapGet("/metrics", (BackendCounters counters) => Results.Json(new { calls = counters.Calls, completed = counters.Completed, cancelled = counters.Cancelled, failed = counters.Failed }));
app.Run();

/// <summary>Counts real backend requests and cancellation for the benchmark.</summary>
public sealed class BackendCounters { public long Calls; public long Completed; public long Cancelled; public long Failed; }

/// <summary>Returns deterministic, request-specific fixtures through native gRPC.</summary>
public sealed class FixtureService(BackendCounters counters) : Content.ContentBase {
    /// <summary>Creates page data, respecting request limits, cancellation, and configured delay.</summary>
    public override async Task<Page> GetPage(PageRequest request, ServerCallContext context) {
        Interlocked.Increment(ref counters.Calls);
        try {
            if(request.Rows < 0 || request.Rows > 5000 || request.Strings < 0 || request.Strings > 2 || request.Token.Length > 512 || request.DelayMs < 0 || request.DelayMs > 5000)
                throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid fixture request"));
            if(request.DelayMs > 0) await Task.Delay(request.DelayMs, context.CancellationToken);
            var page = new Page { Token = request.Token, Title = "SSR benchmark <content> & data", Markdown = request.Article ? "# Benchmark article\n\nA deterministic article returned by **gRPC**.\n\n" + string.Concat(Enumerable.Repeat("## Section\n\nContent with paragraphs, *emphasis*, and [links](https://example.com).\n\n- First item\n- Second item\n\n", 32)) : "" };
            for(var i = 0; i < request.Rows; i++) {
                context.CancellationToken.ThrowIfCancellationRequested();
                var row = new Row { Id = i };
                if(request.Strings != 0) for(var field = 0; field < 10; field++) row.TextValues.Add(FieldText(i * 100 + field, field, request.Strings));
                else for(var field = 0; field < 10; field++) row.Values.Add(i * 100 + field);
                page.Rows.Add(row);
            }
            Interlocked.Increment(ref counters.Completed);
            return page;
        } catch(OperationCanceledException) { Interlocked.Increment(ref counters.Cancelled); throw; }
          catch { Interlocked.Increment(ref counters.Failed); throw; }
    }
    /// <summary>Text variant value (must match loadgen/validate.ts fieldText). 1 = escaping: field 3 of each row is markup-significant + non-ASCII.
    /// 2 = text grid: every field a 24-64 char ASCII string, fields 3 and 4 carry &amp; &lt; &gt;.</summary>
    static string FieldText(int value, int field, int profile) => profile == 2 ? GridText(value, field) : field == 3 ? $"<b>\"{value}\"</b> & 'é€漢字𝄞'" : value.ToString(CultureInfo.InvariantCulture);
    static string GridText(int value, int field) => field switch {
        0 => string.Create(CultureInfo.InvariantCulture, $"Northwind Customer {value} Holdings Ltd"),
        1 => string.Create(CultureInfo.InvariantCulture, $"customer.{value}@accounts.example.com"),
        2 => string.Create(CultureInfo.InvariantCulture, $"Order {value} shipped to warehouse 7, aisle 12"),
        3 => string.Create(CultureInfo.InvariantCulture, $"Ada Lovelace & Co <ada.{value}@example.com>"),
        4 => string.Create(CultureInfo.InvariantCulture, $"/catalog/category-{value % 97}/item-{value}?ref=grid&page=2"),
        5 => string.Create(CultureInfo.InvariantCulture, $"Updated 2026-10-07 12:{value % 60:D2}:00 UTC by system"),
        6 => string.Create(CultureInfo.InvariantCulture, $"Awaiting review by finance team, ticket {value}"),
        7 => string.Create(CultureInfo.InvariantCulture, $"Priority normal; SLA 48 hours; region EU-West-{value % 9}"),
        8 => string.Create(CultureInfo.InvariantCulture, $"Tags: billing, invoices, quarterly-report-{value}"),
        _ => string.Create(CultureInfo.InvariantCulture, $"Note: customer prefers email contact, ref {value}"),
    };
}
