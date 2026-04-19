'use client';

export default function CopyAddressButton({ value }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      alert(`Copied: ${value}`);
    } catch {
      alert(value);
    }
  }

  return (
    <button type="button" className="button primary" onClick={handleCopy}>
      Copy Address
    </button>
  );
}
