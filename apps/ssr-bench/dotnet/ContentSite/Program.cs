using Grpc.Net.Client;
using Rivet.Bench;
using Rivet.ContentSite;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Services.AddControllersWithViews(options => options.Filters.Add<RenderTimingFilter>());
builder.Services.AddSingleton(_ => GrpcChannel.ForAddress(Environment.GetEnvironmentVariable("GRPC_URL") ?? "http://localhost:18100"));
builder.Services.AddSingleton(provider => new Content.ContentClient(provider.GetRequiredService<GrpcChannel>()));
builder.Services.AddSingleton<FrontendCounters>();
var app = builder.Build();
app.MapGet("/health", () => Results.Ok(new {status="ready", framework="dotnet", version=Environment.Version.ToString()}));
app.MapGet("/metrics", (FrontendCounters c) => Results.Json(new {completed=c.Completed,failed=c.Failed,cancelled=c.Cancelled,rpcMs=c.RpcMs,parseMs=c.ParseMs,renderMs=c.RenderMs,heapBytes=GC.GetTotalMemory(false),rssBytes=System.Diagnostics.Process.GetCurrentProcess().WorkingSet64}));
app.MapControllers();
app.Run();
