const base_track_path = "/lofi/tracks/";
const base_track_format = ".ogg";

const db_volume = "lofi_volume";

setTimeout(setup, 10);

const tools = {
    getTrackPath: function(off) {
        if (typeof off !== 'number' || off < 0 || off > tracks.length) return "";
        return `${base_track_path}${tracks[off][0]}${base_track_format}`;
    },
    getTrackName: function(off) {
        if (typeof off !== 'number' || off < 0 || off > tracks.length) return "";
        return `${tracks[off][0]}`;
    },
    getCalculateTrackNowAndNext: function() {
        const time_now = Number(new Date()) * 0.001;
        const factor = 11987;
        let time_full = time_now % (track_total_time_ms / 1000.0);
        let show_time = 0;
        let idx = 0;

        for(let i = 0; i < tracks.length; ++i) {
            idx = (factor + idx) % tracks.length;

            if (time_full > (tracks[idx][1] * 0.001)) {
                time_full -= (tracks[idx][1] * 0.001);
                show_time += (tracks[idx][1] * 0.001);
            }
            else break;
        }

        const nxt = (factor + idx) % tracks.length;

        return { 
            idx_now: idx,
            idx_next: nxt,
            path_now: this.getTrackPath(idx),
            path_next: this.getTrackPath(nxt),
            name_curr: this.getTrackName(idx),
            name_next: this.getTrackName(nxt),
            time_curr: time_full,
            time_curr_str: __sec2str(time_full),
            time_total_str: __sec2str(show_time + time_full) };
    }
};

const controls = {
    volume: Number(__checkNullIfSo(localStorage.getItem(db_volume), 0.8)), // 0.0..1.0
    tracks: [ null, null ], /* They'll be new Audio's */

    setVolume: function(new_vol) {
        //if (this.volume != new_vol) console.log(`[LOFI] New volume: ${100.0 * new_vol}%`);
        this.volume = new_vol;
        if (this.volume < 0.0) this.volume = 0.0;
        if (this.volume > 1.0) this.volume = 1.0;

        if (this.tracks[0]) this.tracks[0].volume = this.volume;
        if (this.tracks[1]) this.tracks[1].volume = this.volume;

        localStorage.setItem(db_volume, this.volume);
    }
}

const radial_animation = {
    begin: -1,
    element: null,

    setup: function()
    {
        if (this.element == null) {
            this.element = document.getElementById("player_box");
            this.begin = Number(new Date());
            setInterval(function(){ radial_animation._work(); }, 500);
        }
    },

    _work: function()
    {
        const deg = (135 + (Number(new Date()) - this.begin) / 100) % 360;
        this.element.style.background = `linear-gradient(${deg}deg, hsl(123, 42%, 54%), hsl(180, 42%, 54%))`;
    }
}

function setup() {
    const sli = document.getElementById("slider_vol");
    const box = document.getElementById("player_box");

    /* ========== Volume control ========== */

    sli["_embedSli"] = function(ev){ // abusing on local variable saving more data. This is never shown in DOM
        if (ev.buttons == 0 && ev.type != "mouseup") return -1;
        if (ev.type == "mouseleave") return -1;

        const dx = ev.clientX;
        let percx = (dx - ev.target.offsetLeft) / ev.target.offsetWidth;
        if (percx < 0) percx = 0;
        if (percx > 1) percx = 1;

        ev.target.style.background = 
            "linear-gradient(90deg, " + ev.target.getAttribute("colorhigh") + " " + (100 * (percx)) + "%, " +
            ev.target.getAttribute("colorlow") + " " + (100 * (percx + 0.001)) + "%)";
        
        ev.target.setAttribute("perc", 100 * percx);
        ev.target.children[0].innerText = Math.round(percx * 100) + "%";

        controls.setVolume(percx);
    }    

    sli.addEventListener("mousemove", function(e){ sli["_embedSli"](e);});
    sli.addEventListener("mousedown", function(e){ sli["_embedSli"](e);});
    sli.addEventListener("mouseup",   function(e){ sli["_embedSli"](e);});
    sli.addEventListener("mouseleave",function(e){ sli["_embedSli"](e);});

    sli.style.background = 
        "linear-gradient(90deg, " +
        sli.getAttribute("colorhigh") +
        " " +
        (100 * (controls.volume)) +
        "%, " +
        sli.getAttribute("colorlow") + 
        " " +
        (100 * (controls.volume + 0.001)) + "%)";

    sli.setAttribute("perc", 100 * controls.volume);
    sli.children[0].innerText = Math.round(controls.volume * 100) + "%";

    box.addEventListener("click", function() {
        if (!box["_TASK"]) { // abusing on local variable saving more data. This is never shown in DOM
            console.log(`[LOFI] Triggered start...`);
            box["_TASK"] = setInterval(manage_tracks, 1000);
            manage_tracks();
            radial_animation.setup();
            
        }
    });
}

function manage_tracks() {
    const curr = tools.getCalculateTrackNowAndNext();

    if (controls.tracks[0] == null || controls.tracks[1] == null)
    {
        console.log(`[LOFI] Starting stuff...`);

        controls.tracks[0] = new Audio(curr.path_now);
        controls.tracks[0].addEventListener("canplaythrough", function() { console.log(`[LOFI] Track '${curr.name_curr}' ready.`); })
        controls.tracks[1] = new Audio(curr.path_next);
        controls.tracks[1].addEventListener("canplaythrough", function() { console.log(`[LOFI] Track '${curr.name_next}' ready.`); })

        controls.tracks[0]["_P_REF"] = curr.path_now;
        controls.tracks[1]["_P_REF"] = curr.path_next;

        controls.tracks[0].volume = controls.tracks[1].volume = controls.volume;
        controls.tracks[0].currentTime = curr.time_curr;
        controls.tracks[0].play();

        console.log(`[LOFI] Playing '${curr.name_curr}'. Pre-loading '${curr.name_next}' in the background...`);
    }
    else if (controls.tracks[1]["_P_REF"] === curr.path_now)
    {        
        console.log(`[LOFI] Next track '${curr.name_curr}'! Pre-loading '${curr.name_next}' in the background...`);

        controls.tracks[0] = controls.tracks[1];
        controls.tracks[0].volume = controls.volume;
        controls.tracks[0].play();

        controls.tracks[1] = new Audio(curr.path_next);
        controls.tracks[1].addEventListener("canplaythrough", function() { console.log(`[LOFI] Track '${curr.name_next}' ready.`); })

        controls.tracks[1].volume = controls.volume;
        controls.tracks[1]["_P_REF"] = curr.path_next;
        controls.tracks[0].play();
    }
    else if (controls.tracks[0]["_P_REF"] !== curr.path_now)
    {
        console.log(`[LOFI] Weird situation, abort! Restarting all.`);
        controls.tracks[0].volume = 0;
        controls.tracks[1].volume = 0;
        controls.tracks[0] = null;
        controls.tracks[1] = null;
        return;
    }
    
    const diff = Math.abs(controls.tracks[0].currentTime - curr.time_curr);
    
    if (diff > 2.0) {
        console.log(`Time diff between track and expected time is too high (${diff} sec). Trying to compensate lag...`);
        controls.tracks[0].currentTime = curr.time_curr;
        controls.tracks[0].volume = controls.volume;
        controls.tracks[0].play();
    }

    const key = ", from Album ";    
    const point = curr.name_curr.indexOf(key);

    const name_trk = curr.name_curr.substring(0, point);
    const name_album = curr.name_curr.substring(point + key.length);

    const status_el = document.getElementById("status_msg");

    status_el.innerHTML = `${curr.time_total_str} <strong>&nbsp;::&nbsp;</strong> ${name_trk} - ${name_album} <strong>&nbsp;::&nbsp;</strong> ${curr.time_curr_str}`;
    document.title = `${name_trk} - ${name_album} - ${curr.time_total_str}`;
}

function __checkNullIfSo(val, repl) { if (val === null) return repl; return val; }
function __sec2str(secs) { return new Date(secs * 1000).toISOString().slice(11, 19); }