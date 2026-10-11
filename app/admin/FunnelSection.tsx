import { funnelHint, FUNNEL_THRESHOLDS } from "./funnelThresholds";

export interface PerGuideFunnel {
  slug: string;
  title: string;
  views: number;
  checkoutsStarted: number;
  paidOrders: number;
  viewsToCheckoutPercent: number | null;
  checkoutToPaidPercent: number | null;
}

interface FunnelSectionProps {
  views: number;
  checkoutsStarted: number;
  paidOrders: number;
  trackingStartDate: string | null;
  perGuideFunnel: PerGuideFunnel[] | null;
}

function formatInt(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatDateIST(dateString: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

export function FunnelSection({
  views,
  checkoutsStarted,
  paidOrders,
  trackingStartDate,
  perGuideFunnel,
}: FunnelSectionProps) {
  const hasViews = views > 0;
  const viewsToCheckoutPercent = hasViews ? (checkoutsStarted / views) * 100 : null;
  const checkoutToPaidPercent = checkoutsStarted > 0 ? (paidOrders / checkoutsStarted) * 100 : null;
  const overallPercent = hasViews ? (paidOrders / views) * 100 : null;

  return (
    <section className="admin__section">
      <div className="admin__card">
        <h2 className="admin__section-title">Funnel: views → checkout → paid</h2>

        <div className="admin__funnel-row">
          <div className="admin__funnel-card">
            <p className="admin__card-label">Guide page views</p>
            <p className="admin__card-value">{formatInt(views)}</p>
          </div>

          <div className="admin__funnel-arrow">
            <span className="admin__funnel-arrow-glyph" aria-hidden="true">
              →
            </span>
            <span className="admin__funnel-rate">
              {hasViews ? formatPercent(viewsToCheckoutPercent) : "—"}
            </span>
          </div>

          <div className="admin__funnel-card">
            <p className="admin__card-label">Checkouts started</p>
            <p className="admin__card-value">{formatInt(checkoutsStarted)}</p>
          </div>

          <div className="admin__funnel-arrow">
            <span className="admin__funnel-arrow-glyph" aria-hidden="true">
              →
            </span>
            <span className="admin__funnel-rate">{formatPercent(checkoutToPaidPercent)}</span>
          </div>

          <div className="admin__funnel-card">
            <p className="admin__card-label">Paid orders</p>
            <p className="admin__card-value">{formatInt(paidOrders)}</p>
          </div>
        </div>

        {hasViews ? (
          <p className="admin__card-sub admin__funnel-overall">
            Overall, views to paid: {formatPercent(overallPercent)}
          </p>
        ) : (
          <p className="admin__card-sub admin__funnel-overall">
            {trackingStartDate
              ? `Traffic counting started on ${formatDateIST(trackingStartDate)} — no views recorded for this period yet.`
              : "Traffic counting hasn't recorded any views yet."}
          </p>
        )}

        <p className="admin__funnel-hint">{funnelHint(viewsToCheckoutPercent, checkoutToPaidPercent)}</p>
        <p className="admin__funnel-caption">
          Starting guesses, not rules — edit them in app/admin/funnelThresholds.ts: views→checkout under{" "}
          {FUNNEL_THRESHOLDS.viewsToCheckoutPercent}%, or checkout→paid under{" "}
          {FUNNEL_THRESHOLDS.checkoutToPaidPercent}%.
        </p>
      </div>

      {perGuideFunnel && (
        <div className="admin__card" style={{ marginTop: "var(--space-5)" }}>
          <h2 className="admin__section-title">Funnel by guide</h2>
          {perGuideFunnel.length === 0 ? (
            <p className="admin__state admin__state--inline">No views or checkouts in this period.</p>
          ) : (
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Guide</th>
                    <th>Views</th>
                    <th>Checkouts started</th>
                    <th>Paid</th>
                    <th>Views → checkout</th>
                    <th>Checkout → paid</th>
                  </tr>
                </thead>
                <tbody>
                  {perGuideFunnel.map((g) => (
                    <tr key={g.slug}>
                      <td>{g.title}</td>
                      <td>{formatInt(g.views)}</td>
                      <td>{formatInt(g.checkoutsStarted)}</td>
                      <td>{formatInt(g.paidOrders)}</td>
                      <td>{formatPercent(g.viewsToCheckoutPercent)}</td>
                      <td>{formatPercent(g.checkoutToPaidPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
