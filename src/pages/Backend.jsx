import { useState } from 'react';
import BackendLayout from '../components/BackendLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import RestaurantListAdmin from '../components/RestaurantListAdmin.jsx';
import RestaurantForm from '../components/RestaurantForm.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import { useRestaurants } from '../hooks/useRestaurants.js';
import { useToast } from '../context/ToastContext.jsx';
import { compareByRanking } from '../utils/ratings.js';

function Dashboard({ onLogout }) {
  const { restaurants, addRestaurant, updateRestaurant, deleteRestaurant } = useRestaurants();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = creazione
  const [deleteTarget, setDeleteTarget] = useState(null);

  const ordered = [...restaurants].sort(compareByRanking);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(restaurant) {
    setEditing(restaurant);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleSubmit(payload) {
    // Le mutazioni sono autorizzate lato server: se lanciano, l'errore resta
    // nel form (RestaurantForm lo mostra) e nulla viene scritto in locale.
    if (editing) {
      await updateRestaurant(editing.id, payload);
      toast.success('Recensione aggiornata');
    } else {
      await addRestaurant(payload);
      toast.success('Locale salvato');
    }
    closeForm();
  }

  async function handleConfirmDelete() {
    try {
      await deleteRestaurant(deleteTarget.id);
      toast.success('Recensione eliminata');
    } catch (err) {
      toast.error(err.message || 'Non è stato possibile eliminare la recensione.');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <BackendLayout
      onLogout={onLogout}
      title="Recensioni"
      description="Crea, modifica ed elimina le recensioni pubblicate su PNDR."
      action={
        <button
          type="button"
          onClick={openCreate}
          className="btn btn-primary"
        >
          <Icon name="plus" size={18} />
          Nuovo locale
        </button>
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          title="Non sono ancora presenti recensioni."
          description="Aggiungi il primo locale con il pulsante “Nuovo locale”."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="btn btn-primary"
            >
              <Icon name="plus" size={18} />
              Nuovo locale
            </button>
          }
        />
      ) : (
        <RestaurantListAdmin
          restaurants={ordered}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Modifica recensione' : 'Nuovo locale'}
        size="lg"
      >
        <RestaurantForm initial={editing} onSubmit={handleSubmit} onCancel={closeForm} />
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        restaurantName={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </BackendLayout>
  );
}

/** Area riservata: login se non autenticati, altrimenti dashboard CRUD. */
export default function Backend() {
  return <ProtectedRoute>{({ logout }) => <Dashboard onLogout={logout} />}</ProtectedRoute>;
}
