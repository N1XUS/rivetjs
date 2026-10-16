export const metadata = { title: "Island bench" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width" />
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
