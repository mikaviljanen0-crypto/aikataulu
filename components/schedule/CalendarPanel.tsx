"use client";

import { useState } from "react";
import { finnishHolidays } from "@/lib/calendar";

type Props = {
  extraDaysOff: string[];
  onAdd: (isoDate: string) => void;
  onRemove: (isoDate: string) => void;
  onClose: () => void;
};

function fi(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("fi-FI");
}

export function CalendarPanel({ extraDaysOff, onAdd, onRemove, onClose }: Props) {
  const [date, setDate] = useState("");
  const year = new Date().getFullYear();
  const holidays = [...finnishHolidays(year)].sort();

  return (
    <div className="snedo-dialog-layer">
      <button type="button" className="snedo-dialog-backdrop" onClick={onClose} aria-label="Sulje kalenteri" />
      <section className="snedo-dialog snedo-calendar-dialog" role="dialog" aria-modal="true" aria-label="Projektin työpäiväkalenteri">
        <header className="snedo-dialog-head">
          <div>
            <span className="eyebrow">TYÖMAAN TYÖPÄIVÄT</span>
            <h2>Kalenteri</h2>
            <p>Lauantait, sunnuntait ja Suomen arkipyhät ovat vapaita. Lisää tähän työmaan omat poikkeuspäivät.</p>
          </div>
          <button type="button" className="snedo-close" onClick={onClose} aria-label="Sulje">×</button>
        </header>
        <div className="snedo-dialog-body">
          <form className="calendar-add" onSubmit={(event) => {event.preventDefault(); if(date){onAdd(date);setDate("");}}}>
            <label>Työmaan vapaa- tai poikkeuspäivä <input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label>
            <button type="submit" className="snedo-primary-button">Lisää vapaapäivä</button>
          </form>
          <strong className="calendar-heading">Työmaan omat vapaapäivät</strong>
          <div className="calendar-days">
            {extraDaysOff.length === 0 && <p className="muted-paragraph">Ei työmaakohtaisia poikkeuspäiviä.</p>}
            {[...extraDaysOff].sort().map((day) => (
              <div className="calendar-date-row" key={day}><span>{fi(day)}</span><button type="button" onClick={() => onRemove(day)}>Poista</button></div>
            ))}
          </div>
          <strong className="calendar-heading">Suomen yleiset vapaapäivät {year}</strong>
          <p className="muted-paragraph">{holidays.map(fi).join(" · ")}</p>
          <p className="calendar-tip">Kalenteri vaikuttaa tehtävien loppupäivien ja riippuvuuksien laskentaan. Poikkeuspäiviä ei voi merkitä työpäiviksi viikonlopulle tässä versiossa.</p>
        </div>
      </section>
    </div>
  );
}
