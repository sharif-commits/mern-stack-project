import { useMemo, useState } from 'react';
import { useToast } from './Toast.jsx';
import './MerchandisePurchaseForm.css';

const MerchandisePurchaseForm = ({ event, onSubmit, onCancel }) => {
  const { showError } = useToast();
  const merchandise = event?.merchandise || {};

  const [selection, setSelection] = useState({
    variantSku: '',
    size: '',
    color: '',
    quantity: 1
  });
  const [customFieldResponses, setCustomFieldResponses] = useState({});

  const variants = useMemo(() => merchandise.variants || [], [merchandise]);
  const sizes = useMemo(() => merchandise.sizes || [], [merchandise]);
  const colors = useMemo(() => merchandise.colors || [], [merchandise]);
  const purchaseLimit = merchandise.purchaseLimit || 1;

  const stockLeft = useMemo(() => {
    if (selection.variantSku && variants.length > 0) {
      const variant = variants.find(v => v.sku === selection.variantSku);
      return variant ? variant.stock : 0;
    }
    return merchandise.stock || 0;
  }, [selection.variantSku, variants, merchandise.stock]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const quantity = Number(selection.quantity) || 1;

    if (quantity < 1) {
      showError('Quantity must be at least 1');
      return;
    }
    if (quantity > purchaseLimit) {
      showError(`Purchase limit is ${purchaseLimit} items`);
      return;
    }
    if (quantity > stockLeft) {
      showError('Not enough stock available');
      return;
    }

    if (variants.length > 0 && !selection.variantSku) {
      showError('Please select a variant');
      return;
    }

    const customFields = Array.isArray(event?.customFields) ? event.customFields : [];
    for (const field of customFields) {
      const fieldKey = field.id || field._id || field.label;
      const value = customFieldResponses[fieldKey];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && isEmpty) {
        showError(`${field.label} is required`);
        return;
      }
    }

    onSubmit({
      merchandise: {
        variantSku: selection.variantSku || null,
        size: selection.size || null,
        color: selection.color || null,
        quantity
      },
      customFields: customFieldResponses
    });
  };

  return (
    <div className="merch-form">
      <div className="form-header">
        <h2>Purchase Merchandise</h2>
        <p>{event?.title}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {variants.length > 0 ? (
          <div className="form-group">
            <label>Variant *</label>
            <select
              value={selection.variantSku}
              onChange={(e) => setSelection(prev => ({ ...prev, variantSku: e.target.value }))}
            >
              <option value="">Select variant</option>
              {variants.map((variant) => (
                <option key={variant.sku || `${variant.size}-${variant.color}`} value={variant.sku}>
                  {variant.size || '-'} / {variant.color || '-'} • ₹{variant.price || 0} • {variant.stock || 0} left
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Size</label>
                {sizes.length > 0 ? (
                  <select
                    value={selection.size}
                    onChange={(e) => setSelection(prev => ({ ...prev, size: e.target.value }))}
                  >
                    <option value="">Select size</option>
                    {sizes.map((sizeOption) => (
                      <option key={sizeOption} value={sizeOption}>{sizeOption}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selection.size}
                    onChange={(e) => setSelection(prev => ({ ...prev, size: e.target.value }))}
                    placeholder="e.g., M"
                  />
                )}
              </div>
              <div className="form-group">
                <label>Color</label>
                {colors.length > 0 ? (
                  <select
                    value={selection.color}
                    onChange={(e) => setSelection(prev => ({ ...prev, color: e.target.value }))}
                  >
                    <option value="">Select color</option>
                    {colors.map((colorOption) => (
                      <option key={colorOption} value={colorOption}>{colorOption}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selection.color}
                    onChange={(e) => setSelection(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="e.g., Black"
                  />
                )}
              </div>
            </div>
          </>
        )}

        {Array.isArray(event?.customFields) && event.customFields.length > 0 && (
          <>
            {event.customFields.map((field) => {
              const fieldKey = field.id || field._id || field.label;
              const value = customFieldResponses[fieldKey];

              if (field.type === 'textarea') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <textarea
                      rows="3"
                      value={value || ''}
                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                    />
                  </div>
                );
              }

              if (field.type === 'select') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <select
                      value={value || ''}
                      onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {(field.options || []).map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === 'radio') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <div className="field-options">
                      {(field.options || []).map(option => (
                        <label key={option} className="option-item">
                          <input
                            type="radio"
                            name={`custom-${fieldKey}`}
                            checked={value === option}
                            onChange={() => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: option }))}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              if (field.type === 'checkbox') {
                const selectedValues = Array.isArray(value) ? value : [];
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <div className="field-options">
                      {(field.options || []).map(option => (
                        <label key={option} className="option-item">
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(option)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedValues, option]
                                : selectedValues.filter(v => v !== option);
                              setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: next }));
                            }}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              if (field.type === 'file') {
                return (
                  <div className="form-group" key={fieldKey}>
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: file ? file.name : '' }));
                      }}
                    />
                  </div>
                );
              }

              return (
                <div className="form-group" key={fieldKey}>
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                    value={value || ''}
                    onChange={(e) => setCustomFieldResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                  />
                </div>
              );
            })}
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Quantity</label>
            <input
              type="number"
              min="1"
              max={purchaseLimit}
              value={selection.quantity}
              onChange={(e) => setSelection(prev => ({ ...prev, quantity: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Stock Remaining</label>
            <input type="text" value={stockLeft} readOnly />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary">Confirm Purchase</button>
        </div>
      </form>
    </div>
  );
};

export default MerchandisePurchaseForm;
