/**
 * Curated groupings over the canonical event-type list, so the filter
 * doesn't stay one long flat list as the event catalog keeps growing --
 * 22 types and counting. Not derived automatically (no reflection from
 * the backend's own `audit_log::event::ALL`): adding a new event type
 * there means adding it to a category here too, same caveat that list's
 * own doc comment already accepts for itself. A type that isn't in any
 * category still shows up under "All" -- these are curated presets for
 * the multi-select below, not a partition that could hide something.
 */
const EVENT_CATEGORIES: { label: string; eventTypes: string[] }[] = [
  {
    label: "Authentication",
    eventTypes: [
      "login_succeeded",
      "login_failed",
      "passkey_registered",
      "registration_failed",
      "session_revoked",
      "totp_enrolment_started",
      "totp_enrolment_failed",
      "totp_enrolled",
      "totp_step_up_succeeded",
      "totp_step_up_failed",
      "login_anomaly_detected",
      "session_expired_access_attempt",
      "rate_limit_rejected",
    ],
  },
  {
    label: "Permissions & Roles",
    eventTypes: [
      "authorization_failure",
      "role_granted",
      "role_revoked",
      "auth_configuration_updated",
    ],
  },
  {
    label: "Users & Access",
    eventTypes: [
      "invite_created",
      "invite_refused",
      "account_recovery_initiated",
      "user_deactivated",
      "user_reactivated",
      "audit_log_exported",
    ],
  },
];

const tabClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    active
      ? "bg-blue-600 text-white"
      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
  }`;

/** Category presets, layered on top of the full multi-select below rather
 * than replacing it -- clicking one just sets which event types are
 * selected, so the multi-select still shows (and allows fine-tuning)
 * exactly what's active. */
export default function EventCategoryTabs({
  allEventTypes,
  selectedEventTypes,
  onChange,
}: {
  allEventTypes: string[];
  selectedEventTypes: string[];
  onChange: (eventTypes: string[]) => void;
}) {
  const isActive = (eventTypes: string[]) =>
    eventTypes.length === selectedEventTypes.length &&
    eventTypes.every((type) => selectedEventTypes.includes(type));

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(allEventTypes)}
        className={tabClass(isActive(allEventTypes))}
      >
        All
      </button>
      {EVENT_CATEGORIES.map((category) => {
        const eventTypes = category.eventTypes.filter((type) =>
          allEventTypes.includes(type)
        );
        return (
          <button
            key={category.label}
            type="button"
            onClick={() => onChange(eventTypes)}
            className={tabClass(isActive(eventTypes))}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
