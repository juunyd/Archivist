interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <header className="admin__header">
      <div>
        <h1 className="admin__title">{title}</h1>
        {subtitle && <p className="admin__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin__header-actions">{actions}</div>}
    </header>
  );
}
