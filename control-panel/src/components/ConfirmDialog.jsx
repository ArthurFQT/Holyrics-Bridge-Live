const ConfirmDialog = ({ dialog, onCancel, onConfirm }) => {
  if (!dialog.open) {
    return null;
  }

  return (
    <div className="confirm-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-title">{dialog.title}</h3>
        <p>{dialog.message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {dialog.cancelLabel}
          </button>
          <button type="button" className={dialog.danger ? "danger" : ""} onClick={onConfirm}>
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ConfirmDialog;
