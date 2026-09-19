"use client";
import { useState } from "react";
import { Modal } from "@heroui/react";
import { Trash2 } from "lucide-react";

/**
 * Delete confirmation for a ledger row.
 *
 * HeroUI supplies the accessible dialog (focus trap, escape, aria wiring);
 * every slot is restyled to the brutalist system — square corners, 2px ink
 * borders, hard offset shadow — since HeroUI's defaults are soft and rounded.
 *
 * The actual delete stays a server action: the form posts as it always did,
 * this only gates it behind a confirmation.
 */
export default function ConfirmDelete({
  id,
  label,
  action
}: {
  id: number;
  label: string;
  action: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
        className="flex h-8 w-8 items-center justify-center border-2 border-line bg-card text-ink transition-all hover:bg-blush hover:shadow-hardsm"
      >
        <Trash2 size={14} strokeWidth={2.5} />
      </button>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop className="bg-ink/60" />
        <Modal.Container>
          <Modal.Dialog className="w-full max-w-sm rounded-none border-2 border-line bg-card p-0 shadow-hardlg">
            <Modal.Header className="border-b-2 border-line bg-blush px-5 py-3">
              <Modal.Heading className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
                Delete entry
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="px-5 py-4">
              <p className="text-[15px] font-semibold text-ink">{label}</p>
              <p className="mt-1 text-sm text-muted">
                This removes the transaction permanently. It cannot be undone.
              </p>
            </Modal.Body>

            <Modal.Footer className="flex gap-2 border-t-2 border-line px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="btn-quiet btn-sm flex-1">
                Cancel
              </button>
              <form action={action} className="flex-1">
                <input type="hidden" name="id" value={id} />
                <button className="btn btn-sm w-full bg-blush">Delete</button>
              </form>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </>
  );
}
