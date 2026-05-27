"use client";

export default function DisconnectButton({
  action,
  bankName,
}: {
  action: () => Promise<void>;
  bankName: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="text-xs text-red-500 hover:text-red-700 font-medium"
        onClick={(e) => {
          if (!confirm(`Déconnecter ${bankName} ? Les transactions restent en base.`)) {
            e.preventDefault();
          }
        }}
      >
        Déconnecter
      </button>
    </form>
  );
}
