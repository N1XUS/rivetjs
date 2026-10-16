const NAV = ["politics", "economy", "climate", "science", "health"];

export const metadata = { title: { template: "%s | The Daily Fixture", default: "The Daily Fixture" } };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>
        <header className="site">
          <a className="brand" href="/">
            The Daily Fixture
          </a>
          <nav>
            {NAV.map((t) => (
              <a key={t} href={`/tags/${t}/`}>
                {t}
              </a>
            ))}
          </nav>
        </header>
        {children}
        <footer className="site">
          <p>The Daily Fixture · benchmark fixture content</p>
        </footer>
      </body>
    </html>
  );
}
