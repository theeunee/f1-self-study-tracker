import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';

const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;

describe('parseIcs', () => {
  const from = new Date('2026-11-22T00:00:00Z');
  const to = new Date('2026-11-29T00:00:00Z');

  it('reads a single UTC event', () => {
    const ev = parseIcs(cal('BEGIN:VEVENT\r\nUID:a1\r\nSUMMARY:Team sync\r\nDTSTART:20261125T190000Z\r\nDTEND:20261125T194500Z\r\nEND:VEVENT'), from, to);
    expect(ev).toEqual([{ uid: 'a1', title: 'Team sync', start: '2026-11-25T19:00:00.000Z', end: '2026-11-25T19:45:00.000Z', allDay: false }]);
  });

  it('converts TZID times to UTC', () => {
    const ev = parseIcs(cal('BEGIN:VEVENT\r\nUID:a2\r\nSUMMARY:Dentist\r\nDTSTART;TZID=America/Los_Angeles:20261125T173000\r\nDTEND;TZID=America/Los_Angeles:20261125T180000\r\nEND:VEVENT'), from, to);
    expect(ev[0].start).toBe('2026-11-26T01:30:00.000Z');
  });

  it('expands a weekly rule with BYDAY, skipping EXDATE and outside the range', () => {
    const ev = parseIcs(
      cal('BEGIN:VEVENT\r\nUID:r1\r\nSUMMARY:Study group\r\nDTSTART:20261102T150000Z\r\nDTEND:20261102T160000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH\r\nEXDATE:20261126T150000Z\r\nEND:VEVENT'),
      from,
      to,
    );
    expect(ev.map((e) => e.start)).toEqual(['2026-11-23T15:00:00.000Z']);
  });

  it('applies RECURRENCE-ID overrides and drops cancelled events', () => {
    const ev = parseIcs(
      cal(
        'BEGIN:VEVENT\r\nUID:r2\r\nSUMMARY:Run\r\nDTSTART:20261123T070000Z\r\nDTEND:20261123T080000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEND:VEVENT\r\n' +
          'BEGIN:VEVENT\r\nUID:r2\r\nRECURRENCE-ID:20261124T070000Z\r\nSUMMARY:Long run\r\nDTSTART:20261124T090000Z\r\nDTEND:20261124T110000Z\r\nEND:VEVENT\r\n' +
          'BEGIN:VEVENT\r\nUID:c1\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20261124T120000Z\r\nDTEND:20261124T130000Z\r\nEND:VEVENT',
      ),
      from,
      to,
    );
    expect(ev.map((e) => `${e.title} ${e.start}`)).toEqual([
      'Run 2026-11-23T07:00:00.000Z',
      'Long run 2026-11-24T09:00:00.000Z',
      'Run 2026-11-25T07:00:00.000Z',
    ]);
  });

  it('unfolds long lines and unescapes text', () => {
    const ev = parseIcs(cal('BEGIN:VEVENT\r\nUID:f1\r\nSUMMARY:Coffee\\, then\r\n  a walk\r\nDTSTART:20261123T100000Z\r\nDURATION:PT30M\r\nEND:VEVENT'), from, to);
    expect(ev[0].title).toBe('Coffee, then a walk');
    expect(ev[0].end).toBe('2026-11-23T10:30:00.000Z');
  });
});
