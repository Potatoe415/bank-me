"use client";

import {
  addTaxonomyCategory,
  deleteTaxonomyCategory,
  renameTaxonomyCategory,
} from "@/app/actions";
import type { EditableTaxonomy } from "@/lib/taxonomy";

type CategoriesTabProps = {
  taxonomy: EditableTaxonomy;
};

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 4h11M6.5 1.75h3M6 6.25v5.5M10 6.25v5.5M4.5 4l.5 8.25c.04.7.62 1.25 1.32 1.25h3.36c.7 0 1.28-.55 1.32-1.25L11.5 4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function InlineRenameForm({
  action,
  hiddenFields,
  inputName,
  defaultValue,
  placeholder,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{ name: string; value: string }>;
  inputName: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <form action={action} className="flex-1">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <input
        type="text"
        name={inputName}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
        onBlur={(event) => event.currentTarget.form?.requestSubmit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400"
      />
    </form>
  );
}

function DeleteButton({
  action,
  hiddenFields,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{ name: string; value: string }>;
  label: string;
}) {
  return (
    <form action={action}>
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
      >
        <TrashIcon />
      </button>
    </form>
  );
}

export default function CategoriesTab({ taxonomy }: CategoriesTabProps) {
  // Group paths by first segment for display clarity
  const grouped = new Map<string, string[]>();
  for (const p of taxonomy.paths) {
    const group = p.split(".")[0] ?? "other";
    const list = grouped.get(group) ?? [];
    list.push(p);
    grouped.set(group, list);
  }

  return (
    <div className="space-y-5">
      <form action={addTaxonomyCategory} className="flex gap-3">
        <input
          type="text"
          name="category"
          required
          placeholder="New path (e.g. variable.hobbies)"
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400"
        />
        <button
          type="submit"
          aria-label="Add path"
          title="Add path"
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100"
        >
          <PlusIcon />
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {[...grouped.entries()].map(([group, paths]) => (
          <section
            key={group}
            className="rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {group}
            </p>
            <div className="space-y-2">
              {paths.map((path) => (
                <div key={path} className="flex items-center gap-3">
                  <InlineRenameForm
                    action={renameTaxonomyCategory}
                    hiddenFields={[{ name: "currentCategory", value: path }]}
                    inputName="nextCategory"
                    defaultValue={path}
                    placeholder="Category path"
                  />
                  <DeleteButton
                    action={deleteTaxonomyCategory}
                    hiddenFields={[{ name: "category", value: path }]}
                    label={`Delete ${path}`}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
