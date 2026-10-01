import Link from "next/link";
import { StatusBadge, DataTable, EmptyState } from "@/components/shared/page-chrome";
import { Can } from "@/components/auth/can";
import { ArchiveButton } from "@/components/shared/archive-button";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { archiveDocument } from "@/server/documents";
import { getSecureDocumentUrl } from "@/lib/storage";
import type { DocumentOwnerType } from "@/lib/documents/types";

type DocRow = {
  id: string;
  documentType: string;
  fileName: string;
  referenceNumber?: string | null;
  status: string;
  isCurrent: boolean;
  expirationDate?: Date | null;
  uploadedAt: Date;
  notes?: string | null;
};

export function DocumentsPanel({
  ownerType,
  ownerId,
  documents,
  documentTypes,
  title = "Documents",
}: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documents: DocRow[];
  documentTypes: { value: string; label: string }[];
  title?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Can permission="documents:write">
          <DocumentUploadForm
            ownerType={ownerType}
            ownerId={ownerId}
            documentTypes={documentTypes}
            title="Upload Document"
          />
        </Can>
      </div>
      {documents.length === 0 ? (
        <EmptyState message="No documents uploaded yet." />
      ) : (
        <DataTable headers={["Type", "File", "Ref", "Status", "Expires", "Uploaded", ""]}>
          {documents.map((doc) => (
            <tr key={doc.id} className={!doc.isCurrent ? "bg-slate-50 text-slate-500" : undefined}>
              <td className="px-3 py-2 font-medium">
                {doc.documentType.replaceAll("_", " ")}
                {!doc.isCurrent ? (
                  <span className="ml-1 text-[10px] uppercase text-slate-400">archived</span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={getSecureDocumentUrl({ ownerType, documentId: doc.id })}
                  className="text-sky-700 hover:underline"
                  target="_blank"
                >
                  {doc.fileName}
                </Link>
              </td>
              <td className="px-3 py-2">{doc.referenceNumber ?? "—"}</td>
              <td className="px-3 py-2">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-3 py-2">
                {doc.expirationDate ? doc.expirationDate.toISOString().slice(0, 10) : "—"}
              </td>
              <td className="px-3 py-2">{doc.uploadedAt.toISOString().slice(0, 10)}</td>
              <td className="px-3 py-2 text-right">
                {doc.isCurrent ? (
                  <Can permission="documents:write">
                    <ArchiveButton
                      label="Archive"
                      action={async () => {
                        "use server";
                        await archiveDocument(ownerType, doc.id);
                      }}
                    />
                  </Can>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}
