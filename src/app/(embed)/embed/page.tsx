import { EmbedApp } from "./EmbedApp";

// Loaded inside the HighLevel Custom Page iframe. Everything that needs to know
// who is asking happens in EmbedApp after the single sign-on handshake.
export default function EmbedPage() {
  return <EmbedApp />;
}
