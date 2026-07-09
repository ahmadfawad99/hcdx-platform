export const metadata = {
  title: "HCDX Platform",
  description: "Capture any page. Make it editable. Publish.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
