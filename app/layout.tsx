import "./globals.css";

export const metadata = { title: "Todoist Compare", description: "Today's and this week's Todoist goals, side by side." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
