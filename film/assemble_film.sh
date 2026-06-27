#!/bin/bash
# Assemble "The Last Body at Vale House" into a single MP4:
#   title card -> 25 hero clips (shot order) -> end card,
#   with in-scene CHARACTER DIALOGUE (no narrator) and a synthesized score bed
#   that auto-ducks under the dialogue.  Requires: ffmpeg, curl.
# Usage: bash assemble_film.sh
set -e
B="https://d8j0ntlcm91z4.cloudfront.net/user_3F1O6weMRqXr9LfttZOeEzhHpcP"
W="${1:-vale_build}"; mkdir -p "$W/seg"; cd "$W"

CLIPS=(
 hf_20260627_204907_b1265fde-d53f-4f06-9327-24d0ec38d0d4 hf_20260627_204911_6ab22940-0496-4727-ac86-15ecffa62cba
 hf_20260627_204942_6aabb4e6-a0fe-4fcd-9785-be7d163dcad0 hf_20260627_204944_64dfea10-f2df-4166-bfdd-5b2f8c2ad4f7
 hf_20260627_204916_ddc7bafb-47a7-463c-9e1e-a1b8517b91b2 hf_20260627_204918_70dace8c-cd0f-48df-8276-f0c8485825a6
 hf_20260627_204919_84706fe8-5aec-47fd-b1fc-e17e79e7123d hf_20260627_204947_22e264fd-6e2c-4936-a86b-24583fe9bace
 hf_20260627_204949_a657823c-dfb6-4bb7-bc74-e361e5c2b23d hf_20260627_205222_58ce1512-abaf-4ff3-b400-13f72a679604
 hf_20260627_204954_e5e63243-bc39-42ae-b4e9-da27704274ea hf_20260627_204956_5f923ef0-b498-4744-8657-a7f6296e2aaf
 hf_20260627_204958_82364eba-e869-41dd-b7a3-c90a5d87b804 hf_20260627_205000_780e299a-84d8-4227-818c-111fb621ed93
 hf_20260627_205020_0ce83d19-6bdd-4070-9042-af417afdca69 hf_20260627_205022_257e7d91-d912-4b0f-96e0-330c22122f23
 hf_20260627_205024_a9e3f5f2-8ea5-448a-bf36-f556d664cd9b hf_20260627_205026_98ed7fc4-9b7d-46e8-9226-922ec476bc15
 hf_20260627_205029_80b37dd8-2f7c-4d97-a94f-2dac5ba7ad4b hf_20260627_205030_b03cdd84-0973-4b43-88c2-a702fe6f6bc6
 hf_20260627_205033_5058def9-26f4-4601-abba-0fa3cc902275 hf_20260627_205035_9c6b5a33-b1a2-4cdf-ae46-50d99a23a26f
 hf_20260627_205037_4049b53a-9d7d-4221-b35b-e2bc9c7cc6e3 hf_20260627_205040_ae2311ab-f672-4921-a8c1-614afcd00cd9
 hf_20260627_205100_ac992d7e-08e4-4e82-9165-be8483c0c622 )
TITLE=hf_20260627_225146_78540658-09a1-4e00-8ea5-0215d7348b2a
ENDC=hf_20260627_225147_869c3a21-6c3b-4c9f-ab72-190c2cea7cc5
# dialogue file_id : shot(1-based) : extra_delay_ms_into_shot   (NO narrator)
DLG=(
 hf_20260627_231909_f0925e8c-ef3f-43bb-ab31-9982b06b9b08:3:200    # Driver
 hf_20260627_231912_b67ec6fc-83e2-4aad-9998-d1f471ce4a59:7:600    # Daniel
 hf_20260627_231919_b9637617-345e-4b3a-91ae-c340f6c79f72:8:200    # Elias (phone)
 hf_20260627_231921_de4139de-4278-4a5d-8048-bcf693539f15:9:1200   # Mara whisper
 hf_20260627_231924_3e92e17e-b05e-403b-8f9f-b7c1772d58f7:10:200   # Daniel
 hf_20260627_231926_bbbb6233-08e8-46a1-ba60-005e51eec0f2:10:2200  # Mara
 hf_20260627_231929_a2107d73-315e-4d16-9bc1-ed84e2067352:11:400   # Daniel prays
 hf_20260627_231932_47113b23-1935-412f-9703-aec6f1f186f5:12:300   # Entity
 hf_20260627_231935_8270a0db-9988-4b77-a98c-8e6a2609d2e0:13:300   # Elias
 hf_20260627_231937_1c562b16-aa8b-4024-b81b-c1e07efa6832:14:400   # Entity
 hf_20260627_231939_6d464c54-24cb-4291-b049-94bdc43c1882:15:300   # Elias
 hf_20260627_231942_26fe6a0e-dd23-4d30-b7f8-02c4528d0ce0:16:300   # Father (tape)
 hf_20260627_231944_3db34da9-e211-4630-bb11-c7447a8db20e:17:500   # Entity
 hf_20260627_231946_05250cf0-e84b-4953-871c-525055293dbf:19:300   # Entity
 hf_20260627_231949_6ea2cc55-dd66-421c-9f9e-68083593fca3:20:300   # Entity
 hf_20260627_205201_9b652ef3-e6a8-49d1-bc27-8d0da1bdc60d:21:400   # Mara
 hf_20260627_205204_ceed05b1-4b3f-4511-8754-77ce3536a23a:25:300   # Reflection
)

echo ">> download"; curl -sS -o title.png "$B/$TITLE.png"; curl -sS -o end.png "$B/$ENDC.png"
n=0; for c in "${CLIPS[@]}"; do n=$((n+1)); printf -v f "c%02d.mp4" $n; curl -sS -o "$f" "$B/$c.mp4"; done
j=0; for e in "${DLG[@]}"; do j=$((j+1)); curl -sS -o "d$j.mp3" "$B/${e%%:*}.mp3"; done

VF="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p"
img(){ ffmpeg -y -loop 1 -t "$3" -i "$1" -f lavfi -t "$3" -i anullsrc=cl=stereo:r=48000 -vf "$VF" -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 "seg/$2" -loglevel error; }
clip(){ ffmpeg -y -i "$1" -f lavfi -i anullsrc=cl=stereo:r=48000 -map 0:v:0 -map 1:a:0 -vf "$VF" -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 48000 -ac 2 -shortest "seg/$2" -loglevel error; }

echo ">> normalize"; img title.png t_title.mp4 5; img end.png t_end.mp4 6
: > concat.txt; echo "file 'seg/t_title.mp4'" >> concat.txt
n=0; for c in "${CLIPS[@]}"; do n=$((n+1)); printf -v f "c%02d.mp4" $n; clip "$f" "$f"; echo "file 'seg/$f'" >> concat.txt; done
echo "file 'seg/t_end.mp4'" >> concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy silent_film.mp4 -loglevel error
DUR=$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 silent_film.mp4)

echo ">> score bed (drone + wind + shimmer)"
ffmpeg -y -f lavfi -i "sine=frequency=55:duration=$DUR" -f lavfi -i "sine=frequency=82.41:duration=$DUR" \
 -f lavfi -i "sine=frequency=110:duration=$DUR" -f lavfi -i "anoisesrc=color=brown:duration=$DUR:amplitude=0.5" \
 -f lavfi -i "sine=frequency=220:duration=$DUR" -filter_complex \
 "[0][1][2]amix=inputs=3:normalize=0,volume=0.5,tremolo=f=0.12:d=0.6[dr];[3]highpass=f=140,lowpass=f=820,volume=0.5[wd];\
  [4]volume=0.06,tremolo=f=0.10:d=0.9[sh];[dr][wd][sh]amix=inputs=3:normalize=0,aecho=0.8:0.7:90:0.35,highpass=f=35,lowpass=f=6000,afade=t=in:st=0:d=4,afade=t=out:st=$(awk -v d=$DUR 'BEGIN{print d-4}'):d=4,aformat=channel_layouts=stereo[m]" \
 -map "[m]" -ar 48000 -ac 2 -t $DUR music.wav -loglevel error

echo ">> dialogue bed"; ins=""; fil=""; lbl=""; k=0
for e in "${DLG[@]}"; do s=$(echo "$e"|cut -d: -f2); ex=$(echo "$e"|cut -d: -f3)
  ms=$(awk -v s="$s" -v x="$ex" 'BEGIN{printf "%d",(5+(s-1)*5.041667)*1000+x}')
  ins="$ins -i d$((k+1)).mp3"; fil="$fil[$k]adelay=$ms|$ms,volume=1.5[a$k];"; lbl="$lbl[a$k]"; k=$((k+1)); done
ffmpeg -y $ins -filter_complex "${fil}${lbl}amix=inputs=$k:normalize=0:dropout_transition=0,apad,aresample=48000[d]" -map "[d]" -t "$DUR" -c:a pcm_s16le dialogue.wav -loglevel error

echo ">> mix (duck music under dialogue) + mux"
ffmpeg -y -i music.wav -i dialogue.wav -filter_complex \
 "[0:a]volume=3.2[mus];[mus][1:a]sidechaincompress=threshold=0.015:ratio=8:attack=8:release=320[dk];\
  [dk][1:a]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[out]" \
 -map "[out]" -t "$DUR" -c:a aac -ar 48000 -ac 2 final_audio.m4a -loglevel error
ffmpeg -y -i silent_film.mp4 -i final_audio.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -movflags +faststart THE_LAST_BODY_AT_VALE_HOUSE.mp4 -loglevel error
echo ">> done: $W/THE_LAST_BODY_AT_VALE_HOUSE.mp4 (~137s, 1280x720, dialogue + score)"
