#!/bin/bash
# Assemble "The Last Body at Vale House" into a single MP4:
# title card -> 25 hero clips (shot order) -> end card, with the 6 VO tracks
# laid on their beats. Requires: ffmpeg, curl.  Usage: bash assemble_film.sh
set -e
B="https://d8j0ntlcm91z4.cloudfront.net/user_3F1O6weMRqXr9LfttZOeEzhHpcP"
W="${1:-vale_build}"; mkdir -p "$W/seg"; cd "$W"

# ---- assets (shot order) ----
CLIPS=(
 hf_20260627_204907_b1265fde-d53f-4f06-9327-24d0ec38d0d4   # 1.1
 hf_20260627_204911_6ab22940-0496-4727-ac86-15ecffa62cba   # 1.6
 hf_20260627_204942_6aabb4e6-a0fe-4fcd-9785-be7d163dcad0   # 1.5
 hf_20260627_204944_64dfea10-f2df-4166-bfdd-5b2f8c2ad4f7   # 2.2
 hf_20260627_204916_ddc7bafb-47a7-463c-9e1e-a1b8517b91b2   # 2.4
 hf_20260627_204918_70dace8c-cd0f-48df-8276-f0c8485825a6   # 2.6
 hf_20260627_204919_84706fe8-5aec-47fd-b1fc-e17e79e7123d   # 3.4
 hf_20260627_204947_22e264fd-6e2c-4936-a86b-24583fe9bace   # 4.1
 hf_20260627_204949_a657823c-dfb6-4bb7-bc74-e361e5c2b23d   # 4.4
 hf_20260627_205222_58ce1512-abaf-4ff3-b400-13f72a679604   # 4.5
 hf_20260627_204954_e5e63243-bc39-42ae-b4e9-da27704274ea   # 5.4
 hf_20260627_204956_5f923ef0-b498-4744-8657-a7f6296e2aaf   # 5.5
 hf_20260627_204958_82364eba-e869-41dd-b7a3-c90a5d87b804   # 6.2
 hf_20260627_205000_780e299a-84d8-4227-818c-111fb621ed93   # 6.7
 hf_20260627_205020_0ce83d19-6bdd-4070-9042-af417afdca69   # 7.1
 hf_20260627_205022_257e7d91-d912-4b0f-96e0-330c22122f23   # 8.3
 hf_20260627_205024_a9e3f5f2-8ea5-448a-bf36-f556d664cd9b   # 8.4
 hf_20260627_205026_98ed7fc4-9b7d-46e8-9226-922ec476bc15   # 8.6
 hf_20260627_205029_80b37dd8-2f7c-4d97-a94f-2dac5ba7ad4b   # 8.7
 hf_20260627_205030_b03cdd84-0973-4b43-88c2-a702fe6f6bc6   # 8.8
 hf_20260627_205033_5058def9-26f4-4601-abba-0fa3cc902275   # 8.10
 hf_20260627_205035_9c6b5a33-b1a2-4cdf-ae46-50d99a23a26f   # 10.1
 hf_20260627_205037_4049b53a-9d7d-4221-b35b-e2bc9c7cc6e3   # 10.2
 hf_20260627_205040_ae2311ab-f672-4921-a8c1-614afcd00cd9   # 11.2
 hf_20260627_205100_ac992d7e-08e4-4e82-9165-be8483c0c622   # 12.3
)
TITLE=hf_20260627_225146_78540658-09a1-4e00-8ea5-0215d7348b2a
ENDC=hf_20260627_225147_869c3a21-6c3b-4c9f-ab72-190c2cea7cc5
VO=(  # vo file : 1-based shot number it plays over
 hf_20260627_205150_0555fe17-7641-4fea-8cf4-23388c6f86bf:1
 hf_20260627_205152_596094f7-776a-446d-981f-a32136c91584:3
 hf_20260627_205155_d462ae32-6ea3-439d-bab1-37c6e5821610:8
 hf_20260627_205158_e6cdfaca-c876-487b-be4f-ca7571626f48:11
 hf_20260627_205201_9b652ef3-e6a8-49d1-bc27-8d0da1bdc60d:21
 hf_20260627_205204_ceed05b1-4b3f-4511-8754-77ce3536a23a:25
)

echo ">> downloading"; curl -sS -o title.png "$B/$TITLE.png"; curl -sS -o end.png "$B/$ENDC.png"
n=0; for c in "${CLIPS[@]}"; do n=$((n+1)); printf -v f "c%02d.mp4" $n; curl -sS -o "$f" "$B/$c.mp4"; done
v=0; for e in "${VO[@]}"; do v=$((v+1)); curl -sS -o "vo$v.mp3" "$B/${e%%:*}.mp3"; done

VF="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p"
img(){ ffmpeg -y -loop 1 -t "$3" -i "$1" -f lavfi -t "$3" -i anullsrc=cl=stereo:r=48000 -vf "$VF" \
  -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 "seg/$2" -loglevel error; }
clip(){ ffmpeg -y -i "$1" -f lavfi -i anullsrc=cl=stereo:r=48000 -map 0:v:0 -map 1:a:0 -vf "$VF" \
  -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 -shortest "seg/$2" -loglevel error; }

echo ">> normalizing"; img title.png t_title.mp4 5; img end.png t_end.mp4 6
: > concat.txt; echo "file 'seg/t_title.mp4'" >> concat.txt
n=0; for c in "${CLIPS[@]}"; do n=$((n+1)); printf -v f "c%02d.mp4" $n; clip "$f" "$f"; echo "file 'seg/$f'" >> concat.txt; done
echo "file 'seg/t_end.mp4'" >> concat.txt

echo ">> concat"; ffmpeg -y -f concat -safe 0 -i concat.txt -c copy silent_film.mp4 -loglevel error
DUR=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 silent_film.mp4)

# VO bed: each VO delayed to title(5s) + (shot-1)*5.041667s
echo ">> vo bed"; ins=""; fil=""; lbl=""; k=0
for e in "${VO[@]}"; do
  s=${e##*:}; ms=$(awk -v s="$s" 'BEGIN{printf "%d",(5+(s-1)*5.041667)*1000}')
  ins="$ins -i vo$((k+1)).mp3"; fil="$fil[$k]adelay=$ms|$ms[a$k];"; lbl="$lbl[a$k]"; k=$((k+1))
done
ffmpeg -y $ins -filter_complex "${fil}${lbl}amix=inputs=$k:normalize=0,alimiter=limit=0.95,apad,aresample=48000[m]" \
  -map "[m]" -t "$DUR" -c:a aac -ar 48000 -ac 2 vo_bed.m4a -loglevel error

echo ">> mux"; ffmpeg -y -i silent_film.mp4 -i vo_bed.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac \
  -movflags +faststart THE_LAST_BODY_AT_VALE_HOUSE.mp4 -loglevel error
echo ">> done: $W/THE_LAST_BODY_AT_VALE_HOUSE.mp4 (~137s, 1280x720)"
