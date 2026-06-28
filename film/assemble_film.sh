#!/bin/bash
set -e
cd /tmp/claude-0/-home-user-Example/4235e897-a380-51ec-89b1-1f9b3d820cb2/scratchpad/film
# entry: base|dlgspec|sfxspec   dlg=<key>.mp3  sfx=sfx/<key>.wav   spec="key@ms;key@ms"
ORDER=(
 "t_title|NAR0@800|thunder@900" "prem||thunder@1800" "a1|NARa1@400|thunder@500" "x1||thunder@300" "c01||thunder@2600" "n_12||van_engine@100;vandoor@3500" "n_13||thunder@2000" "c03|d03@300|" "x2||thunder@1500"
 "c02||click@2600" "n_17||doorroll@1500" "n_21||" "c04||" "x5||" "i_s23||" "c05||knock@1500" "i_s25||" "c06||"
 "a2|NARa2@400|whoosh@0;thunder@700" "x3||" "n_31||" "i_s32||" "c07|d07@600|" "n_35||" "x4||" "c08||" "n_42||" "n_43||"
 "c09|d09@1000|" "c10|d10a@200;d10b@2200|" "n_46||knocking@1800" "n_51|d08@1500|phonering@0" "n_53|d11@400|"
 "c11|d12@300|" "c12||boom@1400" "n_61||thunder@800" "c13|d13@300|" "n_63||" "i_s65||" "i_s66||"
 "c14|d14@400|creak@2600"
 "a3|NARa3@400|whoosh@0;thunder@700" "c15|d15@300|" "n_72||" "n_81||" "i_s82|d16@200|" "c16||" "c17||boom@1400" "n_85||"
 "c18|d17@500|" "c19|d19@300|" "c20|d20@300|" "n_89||" "c21|vo5@400|shatter@1400;boom@1450"
 "a4|NARa4@400|whoosh@0;thunder@700" "n_91||" "x6||" "c22||boom@800" "c23||" "i_s103||" "n_111||" "c24||" "n_121||" "i_s122||"
 "c25|vo6@300|click@3000" "t_end||"
)
: > concat.txt; for e in "${ORDER[@]}"; do echo "file 'seg/${e%%|*}.mp4'" >> concat.txt; done
echo ">> concat $(wc -l < concat.txt) segments"
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 21 -c:a aac -ar 48000 -ac 2 -r 24 silent2.mp4 -loglevel error
DUR=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 silent2.mp4); echo ">> DUR=$DUR"
# accumulate offsets
cum=0; DLG=""; SFXL=""
for e in "${ORDER[@]}"; do IFS='|' read -r base dlg sfx <<< "$e"
  sd=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 seg/$base.mp4)
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
# music + storm ambience bed
OUTFADE=$(awk -v d=$DUR 'BEGIN{print d-3}')
ffmpeg -y -f lavfi -i "sine=f=55:d=$DUR" -f lavfi -i "sine=f=82.41:d=$DUR" -f lavfi -i "sine=f=110:d=$DUR" \
 -f lavfi -i "anoisesrc=c=brown:d=$DUR:a=0.6" -f lavfi -i "anoisesrc=c=pink:d=$DUR:a=0.5" -filter_complex \
 "[0][1][2]amix=inputs=3:normalize=0,volume=0.6,tremolo=f=0.12:d=0.6[dr];[3]lowpass=f=470,volume=0.6,tremolo=f=0.1:d=0.7[wd];\
  [4]highpass=f=1200,lowpass=f=7600,volume=0.62[rn];[dr][wd][rn]amix=inputs=3:normalize=0,aecho=0.8:0.6:130:0.3,highpass=f=30,\
  afade=t=in:st=0:d=0.6,afade=t=out:st=$OUTFADE:d=3,volume=1.5,aformat=channel_layouts=stereo[b]" -map "[b]" -ar 48000 -ac 2 -t $DUR bed.wav -loglevel error
# final mix: duck bed under dialogue, add sfx, limiter
ffmpeg -y -i bed.wav -i dlg.wav -i sfx.wav -filter_complex \
 "[1]volume=1.0,asplit=2[dk][dm];[0][dk]sidechaincompress=threshold=0.02:ratio=7:attack=8:release=300[bd];\
  [2]volume=1.05[sx];[bd][dm][sx]amix=inputs=3:normalize=0:dropout_transition=0,alimiter=limit=0.96[o]" \
 -map "[o]" -t "$DUR" -c:a aac -ar 48000 -ac 2 final2.m4a -loglevel error
ffmpeg -y -i silent2.mp4 -i final2.m4a -map 0:v:0 -map 1:a:0 -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -crf 22 -preset veryfast -c:a aac -b:a 160k -movflags +faststart The_Last_Body_at_Vale_House.mp4 -loglevel error
echo "=== DONE ==="; ls -l The_Last_Body_at_Vale_House.mp4 | awk '{print $5,$9}'
ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 The_Last_Body_at_Vale_House.mp4
ffmpeg -i The_Last_Body_at_Vale_House.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
