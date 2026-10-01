"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentOwnerType } from "@/lib/documents/types";
import { uploadDocument } from "@/server/documents";

export function DocumentUploadForm({
  ownerType,
  ownerId,
  documentTypes,
  title = "Upload Document",
  defaultDocumentType,
  onUploaded,
  collapsible = true,
}: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentTypes: { value: string; label: string }[];
  title?: string;
  defaultDocumentType?: string;
  onUploaded?: () => void;
  collapsible?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!collapsible);
  const [documentType, setDocumentType] = useState(
    defaultDocumentType || documentTypes[0]?.value || "OTHER"
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {title}
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Select a file (PDF, JPG, PNG).");
      return;
    }
    startTransition(async () => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const fileBase64 = btoa(binary);

        await uploadDocument({
          ownerType,
          ownerId,
          documentType,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          effectiveDate: effectiveDate || null,
          expirationDate: expirationDate || null,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64,
          replaceCurrent: true,
        });
        setFile(null);
        setNotes("");
        setReferenceNumber("");
        setOpen(collapsible ? false : true);
        onUploaded?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {collapsible ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="documentType">Document Type</Label>
            <select
              id="documentType"
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
            >
              {documentTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="referenceNumber">Reference #</Label>
            <Input
              id="referenceNumber"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="BOL / POD / COI #"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Input
              id="expirationDate"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="file">File (PDF / JPG / PNG)</Label>
            <input
              id="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              capture="environment"
              className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="text-[11px] text-slate-500">
              Mobile camera capture supported. Max 25 MB. Files are stored privately.
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Save Document"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
