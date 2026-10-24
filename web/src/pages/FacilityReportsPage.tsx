import { useEffect, useState, type FormEvent } from 'react';
import { useProfile } from '../auth/useProfile';
import { apiFetch, ApiRequestError } from '../lib/api';
import type { FacilityReport, ReportCategory, ReportStatus, Role } from '../types';

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  lampu: 'Lampu',
  ventilasi: 'Ventilasi',
  kerusakan: 'Kerusakan',
};
const STATUS_LABELS: Record<ReportStatus, string> = {
  baru: 'Baru',
  ditindaklanjuti: 'Ditindaklanjuti',
  selesai: 'Selesai',
};
const NEXT_STATUS: Record<ReportStatus, ReportStatus | null> = {
  baru: 'ditindaklanjuti',
  ditindaklanjuti: 'selesai',
  selesai: null,
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function ReportForm({ onCreated }: { onCreated: (report: FacilityReport) => void }) {
  const [category, setCategory] = useState<ReportCategory>('lampu');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const input = { category, location: location.trim(), description: description.trim() };
    if (!input.location) {
      setError('Lokasi wajib diisi.');
      return;
    }
    if (input.description.length < 5 || input.description.length > 1000) {
      setError('Deskripsi harus terdiri dari 5 sampai 1000 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch<FacilityReport>('/facility-reports', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setLocation('');
      setDescription('');
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err, 'Laporan gagal dikirim. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="card form facility-report-form"
      aria-label="Buat laporan"
      onSubmit={submit}
      noValidate
    >
      <h2>Buat laporan</h2>
      <label htmlFor="report-category">Kategori</label>
      <select
        id="report-category"
        value={category}
        onChange={(event) => setCategory(event.target.value as ReportCategory)}
        disabled={submitting}
      >
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="report-location">Lokasi</label>
      <input
        id="report-location"
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        disabled={submitting}
        required
      />
      <label htmlFor="report-description">Deskripsi</label>
      <textarea
        id="report-description"
        rows={4}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={1000}
        aria-describedby="report-description-hint"
        disabled={submitting}
        required
      />
      <p className="muted hint" id="report-description-hint">
        Jelaskan kondisi fasilitas dalam 5 sampai 1000 karakter.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Mengirim…' : 'Kirim laporan'}
      </button>
    </form>
  );
}

function ReportCard({
  report,
  isAdmin,
  onUpdated,
}: {
  report: FacilityReport;
  isAdmin: boolean;
  onUpdated: (report: FacilityReport) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUS[report.status];

  async function updateStatus() {
    if (!next || updating) return;
    setError(null);
    setUpdating(true);
    try {
      const updated = await apiFetch<FacilityReport>(`/facility-reports/${report.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      onUpdated(updated);
    } catch (err) {
      setError(errorMessage(err, 'Status gagal diperbarui. Coba lagi.'));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <li>
      <article
        className="card facility-report-card"
        aria-labelledby={`facility-report-${report.id}`}
      >
        <header className="facility-report-heading">
          <h2 id={`facility-report-${report.id}`}>
            {CATEGORY_LABELS[report.category]} · {report.location}
          </h2>
          <span className={`badge ${report.status === 'selesai' ? 'badge-ok' : 'badge-warn'}`}>
            {STATUS_LABELS[report.status]}
          </span>
        </header>
        <p className="facility-report-description">{report.description}</p>
        <p className="muted hint">
          Dilaporkan{' '}
          <time dateTime={report.createdAt}>
            {new Date(report.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
          </time>
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {isAdmin && next && (
          <button
            className="facility-report-action"
            type="button"
            onClick={updateStatus}
            disabled={updating}
          >
            {updating
              ? 'Memperbarui…'
              : next === 'ditindaklanjuti'
                ? 'Tindak lanjuti'
                : 'Tandai selesai'}
          </button>
        )}
      </article>
    </li>
  );
}

function ReportsContent({ role }: { role: Role }) {
  const [reports, setReports] = useState<FacilityReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<FacilityReport[]>('/facility-reports')
      .then((list) => {
        if (active) setReports(list);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(errorMessage(err, 'Daftar laporan gagal dimuat. Coba lagi.'));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (loadError)
    return (
      <div className="card">
        <p className="error" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setAttempt((value) => value + 1);
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  if (reports === null)
    return (
      <p className="muted" role="status">
        Memuat laporan…
      </p>
    );

  return (
    <>
      <p className="muted facility-report-intro">
        {role === 'anggota'
          ? 'Laporkan kondisi fasilitas dan pantau tindak lanjut laporan Anda.'
          : role === 'advisor'
            ? 'Pantau semua laporan fasilitas. Perubahan status dilakukan oleh admin.'
            : 'Tindak lanjuti laporan secara berurutan hingga selesai.'}
      </p>
      {notice && <p role="status">{notice}</p>}
      {role !== 'advisor' && (
        <ReportForm
          onCreated={(created) => {
            setReports((list) => [created, ...(list ?? [])]);
            setNotice('Laporan berhasil dikirim.');
          }}
        />
      )}
      <h2>{role === 'anggota' ? 'Laporan saya' : 'Semua laporan'}</h2>
      {reports.length === 0 ? (
        <p className="card muted">
          {role === 'advisor'
            ? 'Belum ada laporan fasilitas untuk dipantau.'
            : 'Belum ada laporan. Gunakan formulir di atas untuk melaporkan kondisi fasilitas.'}
        </p>
      ) : (
        <ul className="cards" aria-label="Daftar laporan fasilitas">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isAdmin={role === 'admin'}
              onUpdated={(updated) => {
                setReports((list) =>
                  list!.map((item) => (item.id === updated.id ? updated : item)),
                );
                setNotice('Status laporan berhasil diperbarui.');
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

export function FacilityReportsPage() {
  const { profile, loading } = useProfile();
  return (
    <section>
      <div className="page-head">
        <h1>Laporan fasilitas</h1>
      </div>
      {loading ? (
        <p className="muted" role="status">
          Memuat profil…
        </p>
      ) : !profile ? (
        <p className="error" role="alert">
          Profil gagal dimuat. Muat ulang halaman untuk mencoba lagi.
        </p>
      ) : (
        <ReportsContent key={profile.id} role={profile.role} />
      )}
    </section>
  );
}
