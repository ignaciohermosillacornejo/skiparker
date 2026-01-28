import { useState } from 'react';
import { getDateStatus } from '../scenario';

interface CalendarProps {
  onDateSelect: (dateStr: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatAriaLabel(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const STYLE_AVAILABLE = { backgroundColor: 'rgba(49, 200, 25, 0.2)', color: 'rgb(0, 0, 0)' };
const STYLE_SOLD_OUT = { backgroundColor: 'rgb(247, 205, 212)', color: 'rgb(0, 0, 0)' };
const STYLE_UNAVAILABLE = { color: 'rgb(170, 170, 170)' };

function buildWeeks(year: number, month: number): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function nextMonthYear(year: number, month: number): [number, number] {
  return month === 11 ? [year + 1, 0] : [year, month + 1];
}

function MonthGrid({ year, month, onDayClick }: { year: number; month: number; onDayClick: (dateStr: string) => void }) {
  const weeks = buildWeeks(year, month);
  return (
    <div className="mbsc-calendar-slide mbsc-flex-col mbsc-ios">
      <div className="mbsc-calendar-title mbsc-ios" style={{ textAlign: 'center', fontWeight: 'bold', padding: '8px 0' }}>
        {MONTH_NAMES[month]}  {year}
      </div>
      <div className="mbsc-calendar-week-days mbsc-flex mbsc-ios">
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="mbsc-calendar-week-day mbsc-flex-1-0-0 mbsc-ios">{d}</div>
        ))}
      </div>
      <div className="mbsc-calendar-table mbsc-flex-col mbsc-flex-1-1 mbsc-ios">
        {weeks.map((w, wi) => (
          <div key={wi} className="mbsc-calendar-row mbsc-flex mbsc-ios">
            {w.map((day, di) => {
              if (day === null) {
                return (
                  <div key={di} className="mbsc-calendar-cell mbsc-flex-1-0-0 mbsc-calendar-day mbsc-ios mbsc-ltr mbsc-calendar-day-empty">
                    <div className="mbsc-calendar-cell-inner mbsc-calendar-day-inner mbsc-ios">
                      <div className="mbsc-calendar-cell-text mbsc-calendar-day-text mbsc-ios"></div>
                    </div>
                  </div>
                );
              }

              const dateStr = formatDateStr(year, month, day);
              const status = getDateStatus(dateStr);
              const ariaLabel = formatAriaLabel(year, month, day);

              let dayStyle: React.CSSProperties = {};
              if (status === 'available') dayStyle = STYLE_AVAILABLE;
              else if (status === 'sold-out') dayStyle = STYLE_SOLD_OUT;
              else if (status === 'unavailable') dayStyle = STYLE_UNAVAILABLE;

              const isDisabled = status === 'no-reservation' || status === 'unavailable';

              return (
                <div
                  key={di}
                  className={`mbsc-calendar-cell mbsc-flex-1-0-0 mbsc-calendar-day mbsc-ios mbsc-ltr${isDisabled ? ' mbsc-disabled' : ''}`}
                >
                  <div className="mbsc-calendar-cell-inner mbsc-calendar-day-inner mbsc-ios">
                    <div
                      aria-label={ariaLabel}
                      aria-pressed="false"
                      aria-disabled={status === 'unavailable' ? 'true' : undefined}
                      className="mbsc-calendar-cell-text mbsc-calendar-day-text mbsc-ios"
                      style={dayStyle}
                      role="button"
                      onClick={() => {
                        if (status === 'available') onDayClick(dateStr);
                      }}
                    >
                      {day}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Calendar({ onDateSelect }: CalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [year2, month2] = nextMonthYear(year, month);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function goNextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="mbsc-datepicker mbsc-flex-col mbsc-datepicker-inline mbsc-ios mbsc-datepicker-control-calendar">
      <div className="mbsc-calendar mbsc-ios mbsc-calendar-width-md">
        <div className="mbsc-calendar-wrapper">
          <div className="mbsc-calendar-header">
            <div className="mbsc-calendar-controls mbsc-flex mbsc-ios">
              <button className="custom-prev" onClick={prevMonth} type="button">&lt;</button>
              <div style={{ flex: 1 }} />
              <button className="custom-next" onClick={goNextMonth} type="button">&gt;</button>
            </div>
          </div>
          <div className="mbsc-calendar-body">
            <div className="mbsc-calendar-body-inner mbsc-ios" style={{ display: 'flex', gap: '24px' }}>
              <MonthGrid year={year} month={month} onDayClick={onDateSelect} />
              <MonthGrid year={year2} month={month2} onDayClick={onDateSelect} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
