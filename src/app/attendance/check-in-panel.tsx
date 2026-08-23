'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';

import { evaluate, navigationUrl, type GeofenceResult } from '@/lib/geofence';
import { formatDistance, formatSiteTime } from '@/lib/format';

import { submitCheckIn, submitCheckOut } from './actions';

/**
 * The check-in moment.
 *
 * WHAT THIS COMPONENT IS FOR: showing the employee where they are
 * relative to the site, so they know whether to walk closer. It runs the
 * same `evaluate()` the server runs, which is why the distance on screen
 * matches the distance in the record.
 *
 * WHAT IT DOES NOT DO: decide anything. It posts a coordinate pair and
 * an accuracy figure; the server re-runs the fence against the project
 * location an administrator set and writes the record only if its OWN
 * verdict accepts. Disabling the button below is a courtesy to the user,
 * not a control — a crafted request bypasses it and is still refused.
 */

type Phase =
  | 'IDLE'
  | 'REQUESTING'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'LOCATED'
  | 'SUBMITTING'
  | 'DONE';

export interface SiteProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  radiusMetres: number;
}

export interface TodayProps {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  status: string;
  minutesLate: number;
  distanceMetres: number;
}

export interface CheckInDict {
  checkedIn: string;
  distanceFromSite: string;
  minutesLate: string;
  checkedOut: string;
  distanceToSite: string;
  opensWithin: string;
  fixAccurate: string;
  opensWithinBody: string;
  dayRecorded: string;
  checkOut: string;
  recording: string;
  attend: string;
  attendHint: string;
  findingYou: string;
  findingYouHint: string;
  tryAgain: string;
  checkInLabel: string;
  almostThere: string;
  tooFar: string;
  onSiteHint: string;
  offSiteHint: string;
  siteBoundary: string;
  siteBoundaryBody: string;
  openInMaps: string;
  cannotReportLocation: string;
  locationDenied: string;
  locationTimeout: string;
  locationUnavailable: string;
}

export function CheckInPanel({
  site,
  today,
  maxAccuracyMetres,
  dict,
}: {
  site: SiteProps;
  today: TodayProps | null;
  maxAccuracyMetres: number;
  dict: CheckInDict;
}) {
  const [phase, setPhase] = useState<Phase>(today ? 'DONE' : 'IDLE');
  const [fix, setFix] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [verdict, setVerdict] = useState<GeofenceResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fence = {
    lat: site.latitude,
    lng: site.longitude,
    radius: site.radiusMetres,
  };

  /**
   * Watch the device position.
   *
   * `watchPosition` rather than `getCurrentPosition`: the first fix a
   * phone returns is often a coarse network estimate, and the GPS one
   * arrives seconds later. Watching lets the distance settle instead of
   * refusing someone on the strength of a 500m cell-tower guess.
   */
  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPhase('UNAVAILABLE');
      setMessage(dict.cannotReportLocation);
      return;
    }

    setPhase('REQUESTING');
    setMessage(null);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setFix(next);
        setVerdict(evaluate(fence, next, next.accuracy));
        setPhase('LOCATED');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPhase('DENIED');
          setMessage(dict.locationDenied);
        } else {
          setPhase('UNAVAILABLE');
          setMessage(
            error.code === error.TIMEOUT
              ? dict.locationTimeout
              : dict.locationUnavailable,
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        // Never accept a cached fix: someone could check in from home on
        // a position their phone remembered from the site yesterday.
        maximumAge: 0,
      },
    );

    // Stop watching after a minute — a permanent watch drains the battery
    // of a phone that is on site all day.
    const stop = window.setTimeout(() => navigator.geolocation.clearWatch(watchId), 60_000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(stop);
    };
  }, [fence.lat, fence.lng, fence.radius, dict]);

  useEffect(() => {
    if (today) setPhase('DONE');
  }, [today]);

  const submit = () => {
    if (!fix) return;
    setPhase('SUBMITTING');
    setMessage(null);

    startTransition(async () => {
      const result = await submitCheckIn({
        projectId: site.projectId,
        latitude: fix.lat,
        longitude: fix.lng,
        accuracy: fix.accuracy,
      });

      if (result.ok) {
        setPhase('DONE');
        // A full reload so the history table and the site card both
        // reflect the record that was just written.
        window.location.reload();
      } else {
        setPhase('LOCATED');
        setMessage(result.message);
      }
    });
  };

  const checkOut = () => {
    setPhase('SUBMITTING');
    startTransition(async () => {
      const result = await submitCheckOut({
        projectId: site.projectId,
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
      });
      if (result.ok) window.location.reload();
      else {
        setPhase('DONE');
        setMessage(result.message);
      }
    });
  };

  /* ---- The visual state, derived from the verdict ---- */
  const state: 'outside' | 'approaching' | 'inside' | 'attended' =
    phase === 'DONE'
      ? 'attended'
      : verdict?.verdict === 'INSIDE'
        ? 'inside'
        : verdict?.verdict === 'APPROACHING'
          ? 'approaching'
          : 'outside';

  const distance = verdict ? formatDistance(verdict.distance) : null;
  const submitting = phase === 'SUBMITTING';
  const canCheckIn = phase === 'LOCATED' && verdict?.accepted === true;

  return (
    <section className={`gts-geo gts-geo-${state}`} aria-labelledby={`site-${site.projectId}`}>
      <div className="gts-grid-editorial" style={{ alignItems: 'stretch' }}>
        {/* ---- Left: distance and the action ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gts-space-5)' }}>
          <div>
            <p className="gts-overline">{site.projectCode}</p>
            <h2
              id={`site-${site.projectId}`}
              className="gts-region-title"
              style={{ marginBlockStart: 'var(--gts-space-2)' }}
            >
              {site.projectName}
            </h2>
            <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
              {site.clientName} · {site.addressLine}
            </p>
          </div>

          {today ? (
            <div>
              <p className="gts-overline">{dict.checkedIn}</p>
              <p className="gts-num gts-num-lg" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
                {formatSiteTime(today.checkInAt)}
              </p>
              <p className="gts-meta">
                {dict.distanceFromSite.replace('{distance}', String(today.distanceMetres))}
                {today.minutesLate > 0 &&
                  ` · ${dict.minutesLate.replace('{minutes}', String(today.minutesLate))}`}
              </p>
              {today.checkOutAt && (
                <p className="gts-meta">
                  {dict.checkedOut.replace('{time}', formatSiteTime(today.checkOutAt))}
                </p>
              )}
            </div>
          ) : distance ? (
            <div>
              <p className="gts-overline">{dict.distanceToSite}</p>
              <p style={{ marginBlockStart: 'var(--gts-space-2)' }}>
                <span className="gts-num gts-num-hero">{distance.value}</span>
                <span className="gts-num-currency">{distance.unit}</span>
              </p>
              <p className="gts-meta">
                {dict.opensWithin.replace('{radius}', String(site.radiusMetres))}
                {fix &&
                  ` · ${dict.fixAccurate.replace('{accuracy}', String(Math.round(fix.accuracy)))}`}
              </p>
            </div>
          ) : (
            <p className="gts-meta">
              {dict.opensWithinBody.replace('{radius}', String(site.radiusMetres))}
            </p>
          )}

          {message && (
            <p className="gts-form-error" role="alert" data-testid="check-in-error">
              {message}
            </p>
          )}

          {/* ---- The action ---- */}
          {today ? (
            today.checkOutAt ? (
              <p className="gts-status gts-status-success">{dict.dayRecorded}</p>
            ) : (
              <button
                type="button"
                className="gts-btn gts-btn-secondary gts-btn-lg"
                onClick={checkOut}
                disabled={phase === 'SUBMITTING'}
              >
                {phase === 'SUBMITTING' ? dict.recording : dict.checkOut}
              </button>
            )
          ) : phase === 'IDLE' ? (
            <button type="button" className="gts-checkin" onClick={locate}>
              {dict.attend}
              <span className="gts-meta">{dict.attendHint}</span>
            </button>
          ) : phase === 'REQUESTING' ? (
            <button type="button" className="gts-checkin" disabled>
              {dict.findingYou}
              <span className="gts-meta">{dict.findingYouHint}</span>
            </button>
          ) : phase === 'DENIED' || phase === 'UNAVAILABLE' ? (
            <button type="button" className="gts-btn gts-btn-secondary gts-btn-lg" onClick={locate}>
              {dict.tryAgain}
            </button>
          ) : (
            /* LOCATED, or SUBMITTING after this button was pressed. */
            <button
              type="button"
              className="gts-checkin"
              onClick={submit}
              // Disabled while submitting too, so a double tap cannot
              // post a second check-in before the first has answered.
              disabled={!canCheckIn || submitting}
            >
              {submitting
                ? dict.recording
                : canCheckIn
                  ? dict.checkInLabel
                  : state === 'approaching'
                    ? dict.almostThere
                    : dict.tooFar}
              <span className="gts-meta">
                {canCheckIn ? dict.onSiteHint : dict.offSiteHint}
              </span>
              {canCheckIn && !submitting && <span className="gts-pulse-ring" />}
            </button>
          )}
        </div>

        {/* ---- Right: the site, and how to get to it ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gts-space-4)' }}>
          <div>
            <p className="gts-overline">{dict.siteBoundary}</p>
            <p className="gts-meta" style={{ marginBlockStart: 'var(--gts-space-2)' }}>
              {dict.siteBoundaryBody
                .replace('{radius}', String(site.radiusMetres))
                .replace('{maxAccuracy}', String(maxAccuracyMetres))}
            </p>
          </div>

          {/*
            Navigation uses the PROJECT's saved coordinates. The employee
            never types a destination, so they cannot navigate themselves
            somewhere else and check in against it.
          */}
          <a
            href={navigationUrl({ lat: site.latitude, lng: site.longitude }, site.projectName)}
            target="_blank"
            rel="noreferrer"
            className="gts-btn gts-btn-secondary"
          >
            {dict.openInMaps}
          </a>
        </div>
      </div>
    </section>
  );
}
