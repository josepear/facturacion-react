import type { InvoiceDocument } from "@/domain/document/types";
import { buildLegacyPreviewModel } from "@/features/invoices/adapters/renderLegacyPreview";
import { getProfileAccentColor } from "@/components/ui/ProfileBadge";
import "@/features/invoices/components/document-live-preview.css";

type DocumentLivePreviewProps = {
  document: InvoiceDocument;
  profileColorKey?: string;
};

export function DocumentLivePreview({ document, profileColorKey }: DocumentLivePreviewProps) {
  const model = buildLegacyPreviewModel(document);
  const accent = profileColorKey ? getProfileAccentColor(profileColorKey) : "";

  return (
    <section className="preview-shell">
      {accent ? (
        <div
          className="preview-profile-accent-strip"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
      ) : null}
      <header className="preview-shell-header">
        <h3>Preview salida oficial (adaptación fiel)</h3>
        <span>React · temporal</span>
      </header>

      <article className="preview-reference-sheet">
        <header className="preview-reference-top-row">
          <div className="preview-reference-brand-panel">
            <p className="preview-reference-brand-label">EMISOR</p>
            <p className="preview-reference-brand-value">{model.issuerLabel}</p>
          </div>
          <div className="preview-reference-services-panel">
            <p className="preview-reference-copy-label">REFERENCIA</p>
            <p>{model.referenceLabel || "Sin referencia"}</p>
          </div>
          <div className="preview-reference-title-panel">{model.title}</div>
        </header>

        <section className="preview-reference-meta-row">
          <div className="preview-issuer-mini-box">
            <p><strong>Perfil:</strong> {model.issuerLabel}</p>
            <p><strong>Base:</strong> {model.totalsBasisLabel}</p>
          </div>

          <div className="preview-issue-boxes">
            <div className="preview-issue-box">
              <span>Fecha de emisión</span>
              <strong>{model.issueDateLabel}</strong>
            </div>
            <div className="preview-issue-box">
              <span>{model.documentLabel}</span>
              <strong>{model.numberLabel}</strong>
            </div>
          </div>

          <div className="preview-client-data-box">
            <p className="preview-client-title">Datos del cliente: {model.clientName}</p>
            <p><strong>Dirección:</strong> {model.clientAddressLabel || "-"}</p>
            {model.clientTaxMetaLabel ? <p><strong>Tipo/País:</strong> {model.clientTaxMetaLabel}</p> : null}
            <p><strong>CIF/NIF:</strong> {model.clientTaxLabel || "-"}</p>
          </div>
        </section>

        <section className="preview-reference-content-row">
          <aside className="preview-reference-side-column">
            <p><strong>Emisión:</strong> {model.issueDateLabel}</p>
            <p><strong>Vencimiento:</strong> {model.dueDateLabel}</p>
            {model.clientEmailLabel ? <p><strong>Email:</strong> {model.clientEmailLabel}</p> : null}
            {model.clientContactLabel ? <p><strong>Contacto:</strong> {model.clientContactLabel}</p> : null}
          </aside>

          <section className="preview-reference-main-column">
            <div className="preview-reference-section-bar">DESGLOSE DE SERVICIOS Y PRODUCTOS</div>
            <div className="preview-reference-item-stack">
              {model.items.length ? (
                model.items.map((item, index) => (
                  <article key={`${item.concept}-${index}`} className="preview-reference-item-block">
                    <div className="preview-reference-item-headline">
                      <h4>{item.concept || "Sin concepto"}</h4>
                      <p className="preview-reference-item-meta">{item.amountLabel}</p>
                    </div>
                    {item.description ? <p className="preview-reference-item-description">{item.description}</p> : null}
                  </article>
                ))
              ) : (
                <article className="preview-reference-item-block">
                  <div className="preview-reference-item-headline">
                    <h4>Sin líneas</h4>
                    <p className="preview-reference-item-meta">0,00 EUR</p>
                  </div>
                </article>
              )}
            </div>
          </section>
        </section>

        <footer className="preview-reference-bottom-row">
          <div className="preview-reference-finance-column">
            <div className="preview-finance-strip">
              {model.financeCells.map((cell, index) => (
                <div
                  key={`${cell.label}-${index}`}
                  className={`preview-finance-cell ${cell.accent ? "is-accent" : ""} ${cell.dark ? "is-dark" : ""}`.trim()}
                >
                  <div className="preview-finance-cell-label">{cell.label}</div>
                  <div className="preview-finance-cell-value">{cell.value}</div>
                </div>
              ))}
            </div>

            <div className="preview-payment-strip">
              <div className="preview-payment-strip-title">FORMA DE PAGO</div>
              <div className="preview-payment-strip-content">
                <div className="preview-payment-method">{model.paymentMethodLabel}</div>
                <div className="preview-payment-account-box">{model.paymentAccountLabel}</div>
              </div>
            </div>
          </div>
        </footer>
      </article>
    </section>
  );
}
