#!/bin/bash
set -e
cd /tmp/claude-0/-home-user-Example/4235e897-a380-51ec-89b1-1f9b3d820cb2/scratchpad/film
# ---- step 0: give the static "dead" inserts a slow creeping push-in (same duration) ----
INSERTS=(i_s23 i_s25 i_s32 i_s65 i_s66 i_s82 i_s103 i_s122)
mkdir -p seg/z
for s in "${INSERTS[@]}"; do
  [ -f seg/$s.mp4 ] || continue
  ffmpeg -y -i seg/$s.mp4 -filter_complex \
   "zoompan=z='min(1.0+0.0016*on,1.14)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=24,format=yuv420p" \
   -an -c:v libx264 -preset veryfast -crf 20 -r 24 seg/z/$s.mp4 -loglevel error
done
echo ">> zoomed ${#INSERTS[@]} inserts"
# helper: resolve a base name to its file (zoomed insert if present)
segfile(){ if [[ " ${INSERTS[*]} " == *" $1 "* ]] && [ -f seg/z/$1.mp4 ]; then echo seg/z/$1.mp4; else echo seg/$1.mp4; fi; }

# entry: base|dlgspec|sfxspec   dlg=<key>.mp3  sfx=sfx/<key>.wav   spec="key@ms;key@ms"
ORDER=(
 "t_title||thunder@900" "prem||thunder@1800" "a1||thunder@500" "x1||thunder@300" "c01||thunder@2600" "n_12||van_engine@100;vandoor@3500" "n_13||thunder@2000" "c03|d03@300|" "x2||thunder@1500"
 "c02||click@2600" "n_17||doorroll@1500" "n_21||" "c04||" "x5||" "i_s23||" "c05||knock@1500" "i_s25||" "c06||"
 "a2||whoosh@0;thunder@700" "x3||" "n_31||" "i_s32||" "c07|d07@600|" "n_35||" "x4||" "c08||" "n_42||" "n_43||"
 "c09|d09@1000|" "c10|d10a@200;d10b@2200|" "n_46||knocking@1800" "n_51|d08@1500|phonering@0" "n_53|d11@400|"
 "c11|d12@300|" "c12||boom@1400" "n_61||thunder@800" "c13|d13@300|" "n_63||" "i_s65||" "i_s66||"
 "c14|d14@400|creak@2600"
 "a3||whoosh@0;thunder@700" "c15|d15@300|" "n_72||" "n_81||" "i_s82|d16@200|" "c16||" "c17||boom@1400" "n_85||"
 "c18|d17@500|" "c19|d19@300|" "c20|d20@300|" "n_89||" "c21|vo5@400|shatter@1400;boom@1450"
 "a4||whoosh@0;thunder@700" "n_91||" "x6||" "c22||boom@800" "c23||" "i_s103||" "n_111||" "c24||" "n_121||" "i_s122||"
 "c25|vo6@300|click@3000" "t_end||"
)
: > concat.txt; for e in "${ORDER[@]}"; do echo "file '$(segfile "${e%%|*}")'" >> concat.txt; done
echo ">> concat $(wc -l < concat.txt) segments"
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -c:a aac -ar 48000 -ac 2 -r 24 silent3.mp4 -loglevel error
DUR=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 silent3.mp4); echo ">> DUR=$DUR"
# ---- cinematic horror grade: cold color, crushed blacks, vignette, film grain ----
ffmpeg -y -i silent3.mp4 -vf \
 "eq=contrast=1.13:saturation=0.80:gamma=0.93:brightness=-0.018,curves=preset=darker,\
colorbalance=rs=-0.045:gs=0.012:bs=0.055:rm=-0.03:bm=0.045:rh=-0.02:bh=0.035,\
vignette=angle=PI/4.2,noise=alls=9:allf=t+u,format=yuv420p" \
 -c:v libx264 -preset medium -crf 20 -r 24 -an graded3.mp4 -loglevel error
echo ">> graded"
# accumulate offsets (durations unchanged by grade/zoom so beds stay in sync)
cum=0; DLG=""; SFXL=""
for e in "${ORDER[@]}"; do IFS='|' read -r base dlg sfx <<< "$e"
  sd=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$(segfile "$base")")
  if [ -n "$dlg" ]; then IFS=';' read -ra ps <<< "$dlg"; for p in "${ps[@]}"; do k=${p%@*};ms=${p#*@}
    off=$(awk -v c=$cum -v i=$ms 'BEGIN{printf "%d",c*1000+i}'); DLG="$DLG $k:$off"; done; fi
  if [ -n "$sfx" ]; then IFS=';' read -ra qs <<< "$sfx"; for q in "${qs[@]}"; do k=${q%@*};ms=${q#*@}
    off=$(awk -v c=$cum -v i=$ms 'BEGIN{printf "%d",c*1000+i}'); SFXL="$SFXL $k:$off"; done; fi
  cum=$(awk -v c=$cum -v s=$sd 'BEGIN{printf "%.4f",c+s}')
done
echo ">> dialogue=$(echo $DLG|wc -w) sfx=$(echo $SFXL|wc -w)"
# dialogue bed
ins="";fil="";lbl="";k=0
for d in $DLG; do f=${d%:*};ms=${d#*:}; ins="$ins -i $f.mp3"; fil="$fil[$k]adelay=$ms|$ms,volume=1.7[a$k];"; lbl="$lbl[a$k]"; k=$((k+1)); done
ffmpeg -y $ins -filter_complex "${fil}${lbl}amix=inputs=$k:normalize=0:dropout_transition=0,apad,aresample=48000[d]" -map "[d]" -t "$DUR" -c:a pcm_s16le dlg.wav -loglevel error
# sfx bed
ins="";fil="";lbl="";k=0
for s in $SFXL; do f=${s%:*};ms=${s#*:}; ins="$ins -i sfx/$f.wav"; fil="$fil[$k]adelay=$ms|$ms,volume=1.0[a$k];"; lbl="$lbl[a$k]"; k=$((k+1)); done
ffmpeg -y $ins -filter_complex "${fil}${lbl}amix=inputs=$k:normalize=0:dropout_transition=0,apad,aresample=48000[s]" -map "[s]" -t "$DUR" -c:a pcm_s16le sfx.wav -loglevel error
# music + storm ambience + low dread drone bed
OUTFADE=$(awk -v d=$DUR 'BEGIN{print d-3}')
ffmpeg -y -f lavfi -i "sine=f=41:d=$DUR" -f lavfi -i "sine=f=55:d=$DUR" -f lavfi -i "sine=f=82.41:d=$DUR" -f lavfi -i "sine=f=110:d=$DUR" \
 -f lavfi -i "anoisesrc=c=brown:d=$DUR:a=0.6" -f lavfi -i "anoisesrc=c=pink:d=$DUR:a=0.5" -filter_complex \
 "[0]volume=0.5,tremolo=f=0.1:d=0.5[drn];[1][2][3]amix=inputs=3:normalize=0,volume=0.55,tremolo=f=0.12:d=0.6[dr];\
  [4]lowpass=f=470,volume=0.6,tremolo=f=0.1:d=0.7[wd];\
  [5]highpass=f=1200,lowpass=f=7600,volume=0.62[rn];[drn][dr][wd][rn]amix=inputs=4:normalize=0,aecho=0.8:0.6:130:0.3,highpass=f=28,\
  afade=t=in:st=0:d=0.6,afade=t=out:st=$OUTFADE:d=3,volume=1.5,aformat=channel_layouts=stereo[b]" -map "[b]" -ar 48000 -ac 2 -t $DUR bed.wav -loglevel error
# final mix: duck bed under dialogue, add sfx, limiter
ffmpeg -y -i bed.wav -i dlg.wav -i sfx.wav -filter_complex \
 "[1]volume=1.0,asplit=2[dk][dm];[0][dk]sidechaincompress=threshold=0.02:ratio=7:attack=8:release=300[bd];\
  [2]volume=1.05[sx];[bd][dm][sx]amix=inputs=3:normalize=0:dropout_transition=0,alimiter=limit=0.96[o]" \
 -map "[o]" -t "$DUR" -c:a aac -ar 48000 -ac 2 final3.m4a -loglevel error
ffmpeg -y -i graded3.mp4 -i final3.m4a -map 0:v:0 -map 1:a:0 -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -crf 21 -preset medium -c:a aac -b:a 160k -movflags +faststart The_Last_Body_at_Vale_House.mp4 -loglevel error
echo "=== DONE ==="; ls -l The_Last_Body_at_Vale_House.mp4 | awk '{print $5,$9}'
ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 The_Last_Body_at_Vale_House.mp4
ffmpeg -i The_Last_Body_at_Vale_House.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
