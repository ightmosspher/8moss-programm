export default function Platzhalter({ titel, text }: { titel: string; text: string }) {
  return (
    <section>
      <h1>{titel}</h1>
      <div className="leer">{text}</div>
    </section>
  );
}
