"use client";
import { Modal, useOverlayState } from "@heroui/react";
import { Trash2 } from "lucide-react";

/**
 * Delete confirmation for a ledger row.
 *
 * HeroUI supplies the accessible dialog (focus trap, escape, aria wiring);
 * the slots are restyled to this app's rounded system, since HeroUI's own
 * defaults carry a different radius and shadow scale.
 *
 * The delete itself stays a server action: the form posts as it always did,
 * this only gates it behind a confirmation.
 */
export default function ConfirmDelete({
  id,
  label,
  action,
  noun = "entry",
  consequence
}: {
  id: number;
  label: string;
  action: (formData: FormData) => void;
  /**
   * What is being deleted, in the words the page uses — "asset", "loan",
   * "file". Titles the dialog and names the thing in the warning.
   */
  noun?: string;
  /**
   * What else goes with it, when deleting reaches further than the row
   * itself. A loan takes its repayments and their ledger rows; an asset takes
   * its value history. Silence about that is how people lose data they
   * assumed was safe.
   */
  consequence?: string;
}) {
  const state = useOverlayState();

  return (
    <>
      <button
        type="button"
        onClick={state.open}
        aria-label={`Delete ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-blush hover:text-ink"
      >
        <Trash2 size={15} strokeWidth={2.2} />
      </button>

      <Modal state={state}>
        <Modal.Backdrop className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]" />
        {/* The container renders position:static by default, which drops the
            dialog into normal flow at the bottom of a long page — pin it. */}
        <Modal.Container className="fixed inset-0 z-50 !w-screen !max-w-none flex items-center justify-center p-4">
          <Modal.Dialog className="w-full max-w-[400px] overflow-hidden rounded-[22px] bg-card p-0 shadow-soft">
            <Modal.Header className="bg-blush px-6 py-4">
              <Modal.Heading className="eyebrow text-ink">Delete {noun}</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="px-6 py-5">
              <p className="text-[15px] font-bold text-ink">{label}</p>
              <p className="mt-2 text-[14px] text-muted">
                {consequence ? `${consequence} ` : ""}
                This removes the {noun} permanently. It cannot be undone.
              </p>
            </Modal.Body>

            <Modal.Footer className="flex gap-3 px-6 pb-6">
              <button type="button" onClick={state.close} className="btn-quiet flex-1">
                Cancel
              </button>
              <form action={action} className="flex-1">
                <input type="hidden" name="id" value={id} />
                <button className="btn w-full">Delete</button>
              </form>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </>
  );
}
