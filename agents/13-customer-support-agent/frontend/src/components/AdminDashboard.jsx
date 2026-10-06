import { useEffect, useMemo, useState } from "react";
import {
  getAdminDashboard,
  getAdminTickets,
  getAdminTicket,
  updateAdminTicketStatus,
  ChatApiError,
} from "../services/api";
import "./AdminDashboard.css";

function AdminDashboard({ token, onSessionExpired }) {
  const [stats, setStats] = useState({
    total_tickets: 0,
    open_tickets: 0,
    in_progress_tickets: 0,
    resolved_tickets: 0,
    high_priority_tickets: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const [dashboardData, ticketsData] = await Promise.all([
        getAdminDashboard(token),
        getAdminTickets(token),
      ]);
      setStats(dashboardData);
      setTickets(ticketsData);
    } catch (err) {
      if (err instanceof ChatApiError && err.kind === "auth") {
        onSessionExpired();
        return;
      }
      setError(err instanceof ChatApiError ? err.message : "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadDashboard();
  }, [token]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.ticket_id?.toLowerCase().includes(query) ||
        ticket.subject?.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const handleViewTicket = async (ticketId) => {
    try {
      setDetailsLoading(true);
      setError("");
      const ticket = await getAdminTicket(ticketId, token);
      setSelectedTicket(ticket);
    } catch (err) {
      if (err instanceof ChatApiError && err.kind === "auth") {
        onSessionExpired();
        return;
      }
      setError(err instanceof ChatApiError ? err.message : "Unable to load ticket details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      setUpdatingTicket(ticketId);
      setError("");

      const updatedTicket = await updateAdminTicketStatus(
        ticketId,
        newStatus,
        token
      );

      setTickets((previous) =>
        previous.map((ticket) =>
          ticket.ticket_id === ticketId
            ? { ...ticket, status: updatedTicket.status }
            : ticket
        )
      );

      if (selectedTicket?.ticket_id === ticketId) {
        setSelectedTicket((previous) => ({
          ...previous,
          status: updatedTicket.status,
        }));
      }

      const dashboardData = await getAdminDashboard(token);
      setStats(dashboardData);
    } catch (err) {
      if (err instanceof ChatApiError && err.kind === "auth") {
        onSessionExpired();
        return;
      }
      setError(err instanceof ChatApiError ? err.message : "Unable to update ticket status.");
    } finally {
      setUpdatingTicket(null);
    }
  };

  const statusLabel = (status) => {
    if (status === "in_progress") return "In Progress";
    if (status === "resolved") return "Resolved";
    return "Open";
  };

  const statusClass = (status) => {
    if (status === "in_progress") return "cs-status-progress";
    if (status === "resolved") return "cs-status-resolved";
    return "cs-status-open";
  };

  const priorityClass = (priority) => {
    if (priority === "high") return "cs-priority-high";
    if (priority === "medium") return "cs-priority-medium";
    return "cs-priority-low";
  };

  const formatDate = (value) => {
    if (!value) return "—";
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) {
    return (
      <main className="cs-admin-page">
        <div className="cs-admin-loading">
          <div className="cs-spinner" />
          <strong>Loading support workspace</strong>
          <span>Getting the latest ticket activity...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="cs-admin-page">
      <div className="cs-admin-container">
        <header className="cs-admin-header">
          <div className="cs-admin-title-wrap">
            <div className="cs-admin-title-icon">CS</div>
            <div>
              <div className="cs-overline">Support operations</div>
              <h1>Admin Dashboard</h1>
              <p>Manage customer support tickets and monitor support activity.</p>
            </div>
          </div>

          <button className="cs-refresh-btn" onClick={loadDashboard} disabled={loading}>
            <span className="cs-refresh-icon">↻</span>
            Refresh
          </button>
        </header>

        {error && (
          <div className="cs-admin-alert" role="alert">
            <span>!</span>
            {error}
          </div>
        )}

        <section className="cs-stat-grid" aria-label="Ticket statistics">
          <article className="cs-stat-card">
            <div className="cs-stat-icon cs-stat-indigo">▦</div>
            <div>
              <span>Total tickets</span>
              <strong>{stats.total_tickets}</strong>
              <small>All support requests</small>
            </div>
          </article>

          <article className="cs-stat-card">
            <div className="cs-stat-icon cs-stat-blue">○</div>
            <div>
              <span>Open tickets</span>
              <strong>{stats.open_tickets}</strong>
              <small>Waiting for action</small>
            </div>
          </article>

          <article className="cs-stat-card">
            <div className="cs-stat-icon cs-stat-amber">◐</div>
            <div>
              <span>In progress</span>
              <strong>{stats.in_progress_tickets}</strong>
              <small>Being handled</small>
            </div>
          </article>

          <article className="cs-stat-card">
            <div className="cs-stat-icon cs-stat-green">✓</div>
            <div>
              <span>Resolved</span>
              <strong>{stats.resolved_tickets}</strong>
              <small>Successfully closed</small>
            </div>
          </article>

          <article className="cs-stat-card cs-stat-card-danger">
            <div className="cs-stat-icon cs-stat-red">!</div>
            <div>
              <span>High priority</span>
              <strong>{stats.high_priority_tickets}</strong>
              <small>Needs attention</small>
            </div>
          </article>
        </section>

        <section className="cs-ticket-panel">
          <div className="cs-panel-top">
            <div>
              <div className="cs-overline">Ticket management</div>
              <h2>Support Tickets</h2>
              <p>Review escalations and update their current status.</p>
            </div>
            <div className="cs-ticket-total">
              {filteredTickets.length} {filteredTickets.length === 1 ? "ticket" : "tickets"}
            </div>
          </div>

          <div className="cs-toolbar">
            <div className="cs-search-box">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket, subject or issue..."
                aria-label="Search support tickets"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </div>

            <select
              className="cs-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              className="cs-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="cs-empty-state">
              <div className="cs-empty-icon">⌕</div>
              <h3>No matching tickets</h3>
              <p>Try changing your search or filters.</p>
            </div>
          ) : (
            <div className="cs-table-scroll">
              <table className="cs-ticket-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.ticket_id}>
                      <td>
                        <span className="cs-ticket-id">{ticket.ticket_id}</span>
                      </td>
                      <td>
                        <div className="cs-subject-cell">
                          <strong>{ticket.subject || "Support request"}</strong>
                          <span>{ticket.description || "No description available"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`cs-priority ${priorityClass(ticket.priority)}`}>
                          <i />
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <select
                          value={ticket.status}
                          disabled={updatingTicket === ticket.ticket_id}
                          onChange={(event) =>
                            handleStatusChange(ticket.ticket_id, event.target.value)
                          }
                          className={`cs-status-select ${statusClass(ticket.status)}`}
                          aria-label={`Status for ${ticket.ticket_id}`}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                      <td>
                        <span className="cs-created">{formatDate(ticket.created_at)}</span>
                      </td>
                      <td>
                        <button
                          className="cs-view-btn"
                          onClick={() => handleViewTicket(ticket.ticket_id)}
                        >
                          View
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedTicket && (
        <div
          className="cs-modal-backdrop"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="cs-ticket-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-modal-title"
          >
            <div className="cs-modal-header">
              <div>
                <span className="cs-overline">Ticket details</span>
                <h2 id="ticket-modal-title">{selectedTicket.ticket_id}</h2>
              </div>
              <button
                className="cs-close-btn"
                onClick={() => setSelectedTicket(null)}
                aria-label="Close ticket details"
              >
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className="cs-modal-loading">
                <div className="cs-spinner" />
                <span>Loading ticket details...</span>
              </div>
            ) : (
              <div className="cs-modal-body">
                <div className="cs-detail-top">
                  <div>
                    <span>Subject</span>
                    <strong>{selectedTicket.subject || "Support request"}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <b className={`cs-status-badge ${statusClass(selectedTicket.status)}`}>
                      {statusLabel(selectedTicket.status)}
                    </b>
                  </div>
                  <div>
                    <span>Priority</span>
                    <b className={`cs-priority ${priorityClass(selectedTicket.priority)}`}>
                      <i />
                      {selectedTicket.priority}
                    </b>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDate(selectedTicket.created_at)}</strong>
                  </div>
                </div>

                <div className="cs-detail-section">
                  <span>Customer issue</span>
                  <p>{selectedTicket.description || "No description available."}</p>
                </div>

                <div className="cs-detail-section">
                  <span>AI response</span>
                  <p>{selectedTicket.ai_response || "No AI response available."}</p>
                </div>

                <div className="cs-id-grid">
                  <div>
                    <span>Customer ID</span>
                    <code>{selectedTicket.user_id}</code>
                  </div>
                  <div>
                    <span>Conversation ID</span>
                    <code>{selectedTicket.conversation_id}</code>
                  </div>
                </div>

                <div className="cs-modal-actions">
                  <span>Update status</span>
                  <button
                    className="cs-modal-action-open"
                    disabled={updatingTicket === selectedTicket.ticket_id}
                    onClick={() => handleStatusChange(selectedTicket.ticket_id, "open")}
                  >
                    Open
                  </button>
                  <button
                    className="cs-modal-action-progress"
                    disabled={updatingTicket === selectedTicket.ticket_id}
                    onClick={() =>
                      handleStatusChange(selectedTicket.ticket_id, "in_progress")
                    }
                  >
                    In Progress
                  </button>
                  <button
                    className="cs-modal-action-resolved"
                    disabled={updatingTicket === selectedTicket.ticket_id}
                    onClick={() =>
                      handleStatusChange(selectedTicket.ticket_id, "resolved")
                    }
                  >
                    Resolved
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminDashboard;
