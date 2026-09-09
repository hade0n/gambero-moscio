import { useState } from 'react';
import BackendLayout from '../components/BackendLayout.jsx';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import RestaurantListAdmin from '../components/RestaurantListAdmin.jsx';
import ReviewPicker from '../components/ReviewPicker.jsx';
import PlaceForm from '../components/PlaceForm.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { AdminListSkeleton } from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';
import { useRestaurants } from '../hooks/useRestaurants.js';
import { useToast } from '../context/ToastContext.jsx';
import { compareByRanking } from '../utils/ratings.js';
import { reviewerGreeting, reviewerLabel } from '../config/users.js';

function Dashboard({ onLogout, user }) {
  const {
    restaurants,
    status,
    error,
    refetch,
    createPlace,
    updatePlace,
    saveReview,
    deleteRestaurant,
  } = useRestaurants();
  const toast = useToast();

  const [placeForm, setPlaceForm] = useState(null); // { editing: place | null } | null
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { place } | null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [duplicate, setDuplicate] = useState(null); // { place } | null

  const ordered = [...restaurants].sort(compareByRanking);
  const currentLabel = reviewerLabel(user);

  function closeAll() {
    setPlaceForm(null);
    setPickerOpen(false);
    setReviewTarget(null);
  }

  async function submitPlace(payload) {
    if (placeForm?.editing) {
      await updatePlace(placeForm.editing.id, payload);
      toast.success('Locale aggiornato');
      closeAll();
      return;
    }
    try {
      await createPlace(payload);
      toast.success('Locale creato');
      closeAll();
    } catch (err) {
      // Duplicato rilevato dal server (stesso nome + città + provincia).
      if (err?.status === 409) {
        const existing =
          restaurants.find((r) => r.id === err.data?.existingId) ?? null;
        closeAll();
        setDuplicate({ place: existing, name: payload.name });
        return;
      }
      throw err; // altri errori: gestiti dal form (messaggio inline)
    }
  }

  async function submitReview(payload) {
    const existed = Boolean(reviewTarget.place.reviews?.[user]);
    await saveReview(reviewTarget.place.id, payload);
    toast.success(existed ? 'Recensione aggiornata' : 'Recensione salvata');
    closeAll();
  }

  async function handleConfirmDelete() {
    try {
      await deleteRestaurant(deleteTarget.id);
      toast.success('Locale eliminato');
    } catch (err) {
      toast.error(err.message || 'Non è stato possibile eliminare il locale.');
    } finally {
      setDeleteTarget(null);
    }
  }

  // Il locale scelto nel picker: ricaviamo la versione aggiornata dallo stato.
  const targetPlace = reviewTarget
    ? restaurants.find((r) => r.id === reviewTarget.place.id) ?? reviewTarget.place
    : null;
  const existingReview = targetPlace?.reviews?.[user] ?? null;

  return (
    <BackendLayout
      onLogout={onLogout}
      title={reviewerGreeting(user)}
      description="Crea un locale una sola volta, poi ognuno scrive la propria recensione."
      action={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPlaceForm({ editing: null })}
            className="btn btn-primary w-full whitespace-normal text-center leading-tight"
          >
            <Icon name="plus" size={18} className="shrink-0" />
            Crea locale
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn btn-secondary w-full whitespace-normal text-center leading-tight"
          >
            <Icon name="edit" size={18} className="shrink-0" />
            Scrivi recensione
          </button>
        </div>
      }
    >
      {status === 'loading' && <AdminListSkeleton />}

      {status === 'error' && (
        <EmptyState
          title="Non è stato possibile caricare i locali."
          description={error || 'Controlla la connessione e riprova.'}
          action={
            <button type="button" onClick={() => refetch()} className="btn btn-primary">
              Riprova
            </button>
          }
        />
      )}

      {status === 'ready' &&
        (ordered.length === 0 ? (
          <EmptyState
            title="Non sono ancora presenti locali."
            description="Crea il primo locale con «+ Crea locale», poi scrivi la tua recensione."
          />
        ) : (
          <RestaurantListAdmin
            restaurants={ordered}
            onEditPlace={(place) => setPlaceForm({ editing: place })}
            onDelete={setDeleteTarget}
          />
        ))}

      {/* Crea / modifica dati del locale */}
      <Modal
        open={Boolean(placeForm)}
        onClose={closeAll}
        title={placeForm?.editing ? 'Modifica locale' : 'Crea locale'}
        size="lg"
      >
        <PlaceForm initial={placeForm?.editing ?? null} onSubmit={submitPlace} onCancel={closeAll} />
      </Modal>

      {/* Scegli un locale da recensire */}
      <Modal open={pickerOpen} onClose={closeAll} title="Scegli un locale da recensire" size="lg">
        <ReviewPicker
          restaurants={ordered}
          user={user}
          onPick={(place) => {
            setPickerOpen(false);
            setReviewTarget({ place });
          }}
        />
      </Modal>

      {/* Scrivi / modifica la propria recensione */}
      <Modal
        open={Boolean(reviewTarget)}
        onClose={closeAll}
        title={existingReview ? 'Modifica la tua recensione' : 'Scrivi la tua recensione'}
        size="lg"
      >
        {targetPlace && (
          <ReviewForm
            placeName={targetPlace.name}
            reviewerLabel={currentLabel}
            initialReview={existingReview}
            onSubmit={submitReview}
            onCancel={closeAll}
          />
        )}
      </Modal>

      {/* Locale già presente: offri di aprirlo invece di crearne un doppione */}
      <Modal
        open={Boolean(duplicate)}
        onClose={() => setDuplicate(null)}
        title="Locale già presente"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-brown-soft">
            Esiste già un locale con lo stesso nome, città e provincia
            {duplicate?.name ? ` («${duplicate.name}»)` : ''}. Aggiungi la tua recensione a
            quello esistente invece di crearne un altro.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="btn btn-secondary"
            >
              Annulla
            </button>
            {duplicate?.place && (
              <button
                type="button"
                onClick={() => {
                  const place = duplicate.place;
                  setDuplicate(null);
                  setReviewTarget({ place });
                }}
                className="btn btn-primary"
              >
                Apri il locale esistente
              </button>
            )}
          </div>
        </div>
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

/** Area riservata: login se non autenticati, altrimenti dashboard. */
export default function Backend() {
  return (
    <ProtectedRoute>
      {({ logout, user }) => <Dashboard onLogout={logout} user={user} />}
    </ProtectedRoute>
  );
}
