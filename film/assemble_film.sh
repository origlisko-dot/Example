#!/bin/bash
# Assemble the EXTENDED cut of "The Last Body at Vale House" into one MP4:
#   title -> 54 shots (45 animated clips + 8 macro inserts, story order) -> end card,
#   with in-scene CHARACTER DIALOGUE (no narrator) + synthesized score bed that
#   auto-ducks under speech.  Requires: ffmpeg, curl.   Usage: bash assemble_film.sh
set -e
B="https://d8j0ntlcm91z4.cloudfront.net/user_3F1O6weMRqXr9LfttZOeEzhHpcP"
W="${1:-vale_build}"; mkdir -p "$W/seg"; cd "$W"
TITLE=225146_78540658-09a1-4e00-8ea5-0215d7348b2a
ENDC=225147_869c3a21-6c3b-4c9f-ab72-190c2cea7cc5
# dialogue key -> CDN time_uuid (mp3)
declare -A DURL=(
 [d03]=231909_f0925e8c-ef3f-43bb-ab31-9982b06b9b08 [d07]=231912_b67ec6fc-83e2-4aad-9998-d1f471ce4a59
 [d08]=231919_b9637617-345e-4b3a-91ae-c340f6c79f72 [d09]=231921_de4139de-4278-4a5d-8048-bcf693539f15
 [d10a]=231924_3e92e17e-b05e-403b-8f9f-b7c1772d58f7 [d10b]=231926_bbbb6233-08e8-46a1-ba60-005e51eec0f2
 [d11]=231929_a2107d73-315e-4d16-9bc1-ed84e2067352 [d12]=231932_47113b23-1935-412f-9703-aec6f1f186f5
 [d13]=231935_8270a0db-9988-4b77-a98c-8e6a2609d2e0 [d14]=231937_1c562b16-aa8b-4024-b81b-c1e07efa6832
 [d15]=231939_6d464c54-24cb-4291-b049-94bdc43c1882 [d16]=231942_26fe6a0e-dd23-4d30-b7f8-02c4528d0ce0
 [d17]=231944_3db34da9-e211-4630-bb11-c7447a8db20e [d19]=231946_05250cf0-e84b-4953-871c-525055293dbf
 [d20]=231949_6ea2cc55-dd66-421c-9f9e-68083593fca3 [vo5]=205201_9b652ef3-e6a8-49d1-bc27-8d0da1bdc60d
 [vo6]=205204_ceed05b1-4b3f-4511-8754-77ce3536a23a )
# ORDER: type|time_uuid|dlgspec(key@intraMs;key@intraMs)   type v=clip i=macro-insert(3.5s still)
ORDER=(
 "v|204907_b1265fde-d53f-4f06-9327-24d0ec38d0d4|" "v|233924_1da2512f-2cef-46f6-b299-5ed9977fc265|"
 "v|233926_31539437-ef56-4793-ae06-88ed011ebe65|" "v|204942_6aabb4e6-a0fe-4fcd-9785-be7d163dcad0|d03@300"
 "v|204911_6ab22940-0496-4727-ac86-15ecffa62cba|" "v|233928_b8c4ec99-f208-47ce-aff6-fe802f739a40|"
 "v|233931_38be24a5-bc38-4dbe-a7a0-a6c17d8aa243|" "v|204944_64dfea10-f2df-4166-bfdd-5b2f8c2ad4f7|"
 "i|204349_76a63fde-7066-40e1-814c-5605964c5cf2|" "v|204916_ddc7bafb-47a7-463c-9e1e-a1b8517b91b2|"
 "i|204353_0eccd609-e200-40a7-b505-344c21f01024|" "v|204918_70dace8c-cd0f-48df-8276-f0c8485825a6|"
 "v|233933_1e517216-6da6-487f-9585-9a1bb4b308ca|" "i|204418_363764ad-166b-435f-9c7f-f0f4142cce23|"
 "v|204919_84706fe8-5aec-47fd-b1fc-e17e79e7123d|d07@600" "v|233935_a577f740-d588-4587-9dc4-de332318a980|"
 "v|204947_22e264fd-6e2c-4936-a86b-24583fe9bace|" "v|233937_54db33e7-e24a-4af6-bd2e-131d68119c97|"
 "v|233940_4395e1c1-df58-43bf-8a7d-817debae4c75|" "v|204949_a657823c-dfb6-4bb7-bc74-e361e5c2b23d|d09@1000"
 "v|205222_58ce1512-abaf-4ff3-b400-13f72a679604|d10a@200;d10b@2200" "v|233942_32e77fd7-6cf1-476e-b04e-fe1c7f2d488a|"
 "v|233943_1c7328de-ed99-4b42-8e0f-34a0534c8e66|d08@400" "v|233956_ac6ef5a5-ee5b-4d9c-9325-567b016e1202|d11@400"
 "v|204954_e5e63243-bc39-42ae-b4e9-da27704274ea|d12@300" "v|204956_5f923ef0-b498-4744-8657-a7f6296e2aaf|"
 "v|233958_059d5c8f-3bc7-4ba2-acaf-408edd093d28|" "v|204958_82364eba-e869-41dd-b7a3-c90a5d87b804|d13@300"
 "v|234000_55b702c1-d416-42ea-80aa-28c79c094fe7|" "i|204530_eb9f4c86-77d8-4253-806c-c762e4660976|"
 "i|204533_fc9ce440-4a66-4d92-91cd-46c69e5aa743|" "v|205000_780e299a-84d8-4227-818c-111fb621ed93|d14@400"
 "v|205020_0ce83d19-6bdd-4070-9042-af417afdca69|d15@300" "v|234002_0406a403-e5cd-4850-a9e2-45029be8bb2a|"
 "v|234005_db92a406-3dff-4092-a56e-e29d5c30f26e|" "i|204613_2fd5c368-df5d-4998-b7ca-1cd2ea1d03c8|d16@200"
 "v|205022_257e7d91-d912-4b0f-96e0-330c22122f23|" "v|205024_a9e3f5f2-8ea5-448a-bf36-f556d664cd9b|"
 "v|234008_807857cb-69aa-4115-b6bc-a77af61fe295|" "v|205026_98ed7fc4-9b7d-46e8-9226-922ec476bc15|d17@500"
 "v|205029_80b37dd8-2f7c-4d97-a94f-2dac5ba7ad4b|d19@300" "v|205030_b03cdd84-0973-4b43-88c2-a702fe6f6bc6|d20@300"
 "v|234010_9d4ca087-de0f-4fd8-bc1f-786a7cba14bf|" "v|205033_5058def9-26f4-4601-abba-0fa3cc902275|vo5@400"
 "v|234012_c0b227f8-5f52-4186-9ed6-f2e16eff2c91|" "v|205035_9c6b5a33-b1a2-4cdf-ae46-50d99a23a26f|"
 "v|205037_4049b53a-9d7d-4221-b35b-e2bc9c7cc6e3|" "i|204647_26de7a51-08cc-49fd-82b2-256d7f28ec55|"
 "v|234015_ec36ba4f-4148-454c-9d4d-13ae59ec5d71|" "v|205040_ae2311ab-f672-4921-a8c1-614afcd00cd9|"
 "v|234017_73cbd4f6-0112-46e0-a6c6-608af8430c26|" "i|204656_0aeae50f-932c-473c-a09f-3e50a6489f59|"
 "v|205100_ac992d7e-08e4-4e82-9165-be8483c0c622|vo6@300"
)
VF="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p"
img(){ ffmpeg -y -loop 1 -t "$3" -i "$1" -f lavfi -t "$3" -i anullsrc=cl=stereo:r=48000 -vf "$VF,fade=t=in:st=0:d=0.4,fade=t=out:st=$(awk -v d=$3 'BEGIN{print d-0.4}'):d=0.4" -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 "seg/$2" -loglevel error; }
clip(){ ffmpeg -y -i "$1" -f lavfi -i anullsrc=cl=stereo:r=48000 -map 0:v:0 -map 1:a:0 -vf "$VF" -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 -shortest "seg/$2" -loglevel error; }

echo ">> title/end"; curl -sS -o t.png "$B/hf_20260627_$TITLE.png"; curl -sS -o e.png "$B/hf_20260627_$ENDC.png"
img t.png t_title.mp4 5; img e.png t_end.mp4 6
: > concat.txt; echo "file 'seg/t_title.mp4'" >> concat.txt
echo ">> shots"; n=0
for entry in "${ORDER[@]}"; do
  IFS='|' read -r typ id dlg <<< "$entry"; n=$((n+1)); printf -v key "s%02d" $n
  if [ "$typ" = "v" ]; then curl -sS -o "$key.mp4" "$B/hf_20260627_$id.mp4"; clip "$key.mp4" "$key.mp4"
  else curl -sS -o "$key.png" "$B/hf_20260627_$id.png"; img "$key.png" "$key.mp4" 3.5; fi
  echo "file 'seg/$key.mp4'" >> concat.txt; printf "."
done; echo
echo "file 'seg/t_end.mp4'" >> concat.txt
echo ">> concat (re-encode for clean timestamps)"
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 -r 24 silent_full.mp4 -loglevel error
DUR=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 silent_full.mp4)
echo ">> total = $DUR"
echo ">> dialogue offsets"; cum=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 seg/t_title.mp4)
DLST=""; n=0
for entry in "${ORDER[@]}"; do
  IFS='|' read -r typ id dlg <<< "$entry"; n=$((n+1)); printf -v key "s%02d" $n
  sd=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 seg/$key.mp4)
  if [ -n "$dlg" ]; then IFS=';' read -ra ps <<< "$dlg"; for p in "${ps[@]}"; do k=${p%@*}; intra=${p#*@};
    ms=$(awk -v c="$cum" -v i="$intra" 'BEGIN{printf "%d",c*1000+i}'); DLST="$DLST ${DURL[$k]}@$ms"; done; fi
  cum=$(awk -v c="$cum" -v s="$sd" 'BEGIN{printf "%.4f",c+s}')
done
echo ">> score bed"; ffmpeg -y -f lavfi -i "sine=frequency=55:duration=$DUR" -f lavfi -i "sine=frequency=82.41:duration=$DUR" -f lavfi -i "sine=frequency=110:duration=$DUR" -f lavfi -i "anoisesrc=color=brown:duration=$DUR:amplitude=0.5" -f lavfi -i "sine=frequency=220:duration=$DUR" -filter_complex "[0][1][2]amix=inputs=3:normalize=0,volume=0.5,tremolo=f=0.12:d=0.6[dr];[3]highpass=f=140,lowpass=f=820,volume=0.5[wd];[4]volume=0.06,tremolo=f=0.10:d=0.9[sh];[dr][wd][sh]amix=inputs=3:normalize=0,aecho=0.8:0.7:90:0.35,highpass=f=35,lowpass=f=6000,afade=t=in:st=0:d=4,afade=t=out:st=$(awk -v d=$DUR 'BEGIN{print d-4}'):d=4,aformat=channel_layouts=stereo[m]" -map "[m]" -ar 48000 -ac 2 -t $DUR music.wav -loglevel error
echo ">> dialogue bed"; ins=""; fil=""; lbl=""; k=0
for d in $DLST; do u=${d%@*}; ms=${d#*@}; curl -sS -o dq$k.mp3 "$B/hf_20260627_$u.mp3"; ins="$ins -i dq$k.mp3"; fil="$fil[$k]adelay=$ms|$ms,volume=1.6[a$k];"; lbl="$lbl[a$k]"; k=$((k+1)); done
ffmpeg -y $ins -filter_complex "${fil}${lbl}amix=inputs=$k:normalize=0:dropout_transition=0,apad,aresample=48000[d]" -map "[d]" -t "$DUR" -c:a pcm_s16le dialogue.wav -loglevel error
echo ">> mix + mux"; ffmpeg -y -i music.wav -i dialogue.wav -filter_complex "[0:a]volume=3.2[mus];[mus][1:a]sidechaincompress=threshold=0.015:ratio=8:attack=8:release=320[dk];[dk][1:a]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[out]" -map "[out]" -t "$DUR" -c:a aac -ar 48000 -ac 2 fa.m4a -loglevel error
ffmpeg -y -i silent_full.mp4 -i fa.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -movflags +faststart THE_LAST_BODY_AT_VALE_HOUSE.mp4 -loglevel error
echo ">> done: $W/THE_LAST_BODY_AT_VALE_HOUSE.mp4 (~266s, 54 shots, dialogue + score)"
