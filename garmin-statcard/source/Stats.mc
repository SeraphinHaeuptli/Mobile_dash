import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.UserProfile;

// Reads the stats this watch exposes to apps and formats them for display/sharing.
module Stats {

    function setting(key) {
        var v = Application.Properties.getValue(key);
        return (v instanceof String) ? v : "";
    }

    function title() {
        var name = setting("displayName");
        return (name.length() > 0) ? name + "'s stats" : "My stats";
    }

    // Any value may be null when the watch doesn't support it.
    function collect() {
        var s = {};
        var info = ActivityMonitor.getInfo();
        s[:steps] = info.steps;
        if (info has :activeMinutesWeek && info.activeMinutesWeek != null) {
            s[:activeMinWeek] = info.activeMinutesWeek.total;
        }

        // Distance for today plus the previous 6 days.
        var cm = (info.distance != null) ? info.distance : 0;
        var today = Time.today();
        var cutoff = today.subtract(new Time.Duration(6 * 86400));
        var history = ActivityMonitor.getHistory();
        if (history != null) {
            for (var i = 0; i < history.size(); i++) {
                var day = history[i];
                if (day.distance != null && day.startOfDay != null
                        && day.startOfDay.compare(cutoff) >= 0 && day.startOfDay.compare(today) < 0) {
                    cm += day.distance;
                }
            }
        }
        s[:weekCm] = cm;

        var profile = UserProfile.getProfile();
        if (profile has :restingHeartRate) {
            s[:restingHr] = profile.restingHeartRate;
        }
        if (profile has :vo2maxRunning) {
            s[:vo2max] = profile.vo2maxRunning;
        }

        // Most recent recorded activity (API 3.3+).
        if (UserProfile has :getUserActivityHistory) {
            var it = UserProfile.getUserActivityHistory();
            var a = it.next();
            var last = null;
            while (a != null) {
                if (a.startTime != null && (last == null || a.startTime.compare(last.startTime) > 0)) {
                    last = a;
                }
                a = it.next();
            }
            s[:last] = last;
        }
        return s;
    }

    // Short lines (about 17 characters) so they fit a small round screen.
    function lines(s) {
        var out = [];
        if (s[:steps] != null) {
            out.add(s[:steps].toString() + " steps today");
        }
        out.add(distanceText(s[:weekCm]) + " / 7 days");
        if (s[:activeMinWeek] != null) {
            out.add(s[:activeMinWeek].toString() + " active min/wk");
        }
        if (s[:restingHr] != null) {
            out.add("Resting HR " + s[:restingHr]);
        }
        if (s[:vo2max] != null) {
            out.add("VO2 max " + s[:vo2max]);
        }
        var last = s[:last];
        if (last != null) {
            var line = "Last: " + sportName(last.type);
            if (last.distance != null && last.distance > 0) {
                line += " " + distanceText(last.distance * 100);
            }
            out.add(line);
            if (last.duration != null) {
                out.add("Time " + durationText(last.duration.value()));
            }
        }
        return out;
    }

    // Plain-text card for the stats QR code: as many lines as fit in one code.
    function shareText() {
        var text = title() + " (Garmin)";
        var body = lines(collect());
        for (var i = 0; i < body.size(); i++) {
            var next = text + "\n" + body[i];
            if (next.toUtf8Array().size() > QrCode.MAX_BYTES) {
                break;
            }
            text = next;
        }
        return text;
    }

    function distanceText(cm) {
        if (System.getDeviceSettings().distanceUnits == System.UNIT_STATUTE) {
            return (cm / 160934.4).format("%.1f") + " mi";
        }
        return (cm / 100000.0).format("%.1f") + " km";
    }

    function durationText(secs) {
        var h = secs / 3600;
        var m = (secs % 3600) / 60;
        var s = secs % 60;
        if (h > 0) {
            return h.toString() + ":" + m.format("%02d") + ":" + s.format("%02d");
        }
        return m.toString() + ":" + s.format("%02d");
    }

    // FIT sport numbers.
    function sportName(sport) {
        if (sport == 1) {
            return "Run";
        } else if (sport == 2) {
            return "Ride";
        } else if (sport == 5) {
            return "Swim";
        } else if (sport == 11) {
            return "Walk";
        } else if (sport == 17) {
            return "Hike";
        }
        return "Activity";
    }
}
