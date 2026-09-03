// Page d'accueil minimale (le front complet est la Phase 2).
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>OSRune</h1>
      <p>Un monde peuple d'agents autonomes. Je pars. Le monde vit. Je reviens.</p>
      <p>L'interface de jeu arrive en Phase 2. L'API de la Phase 1 est en ligne :</p>
      <ul>
        <li><code>POST /api/worlds</code> — creer un monde</li>
        <li><code>GET /api/worlds/:id</code> — etat (declenche le rattrapage)</li>
        <li><code>GET /api/worlds/:id/catchup</code> — progression</li>
        <li><code>GET /api/worlds/:id/days?from&amp;to</code> — chroniques</li>
      </ul>
    </main>
  );
}
