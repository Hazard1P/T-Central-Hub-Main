export default function LegalDocumentBody({ section }) {
  return (
    <>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {section.items?.length ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </>
  );
}
