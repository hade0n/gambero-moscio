import { useRef } from 'react';
import Modal from './Modal.jsx';

/** Conferma di eliminazione. Il primo click apre questa modale, non elimina. */
export default function ConfirmDeleteModal({ open, restaurantName, onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Eliminare questo locale?"
      size="sm"
      initialFocusRef={cancelRef}
    >
      <p className="text-brown">
        {restaurantName ? (
          <>
            Il locale <span className="font-semibold">{restaurantName}</span> e le sue recensioni
            verranno rimossi definitivamente.
          </>
        ) : (
          'Il locale e le sue recensioni verranno rimossi definitivamente.'
        )}
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn-secondary">
          Annulla
        </button>
        <button type="button" onClick={onConfirm} className="btn btn-danger">
          Elimina
        </button>
      </div>
    </Modal>
  );
}
