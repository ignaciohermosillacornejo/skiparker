import { useState } from 'react';
import { getDateStatus } from '../scenario';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function statusToClass(status: string): string {
  switch (status) {
    case 'available': return 'fc-available';
    case 'sold-out': return 'fc-unavailable';
    case 'no-reservation': return 'no-reserve';
    default: return 'calendar_disabled';
  }
}

interface Props {
  onDateSelect?: (dateStr: string) => void;
}

export default function CrystalCalendar({ onDateSelect }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`pad-${i}`} className="calendar_day calendar_disabled" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, month, d);
    const isoDate = `${dateStr}T07:00:00.000Z`;
    const status = getDateStatus(dateStr);
    const cls = statusToClass(status);
    const isDisabled = status === 'unavailable';

    days.push(
      <div
        key={dateStr}
        className={`calendar_day ${cls}`}
        data-date={isoDate}
        aria-disabled={isDisabled ? 'true' : undefined}
        onClick={() => status === 'available' && onDateSelect?.(dateStr)}
        style={{ cursor: status === 'available' ? 'pointer' : 'default' }}
      >
        {d}
      </div>
    );
  }

  const goNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else { setMonth(m => m + 1); }
  };
  const goPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else { setMonth(m => m - 1); }
  };

  return (
    <div id="calendar" style={{ maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button id="calendarNavLeft" onClick={goPrev}>&larr;</button>
        <strong>{monthName}</strong>
        <button id="calendarNavRight" onClick={goNext}>&rarr;</button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        textAlign: 'center',
      }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ fontWeight: 'bold', fontSize: 12 }}>{d}</div>
        ))}
        {days}
      </div>
    </div>
  );
}
