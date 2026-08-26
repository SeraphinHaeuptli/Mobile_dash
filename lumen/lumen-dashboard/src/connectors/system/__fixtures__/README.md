# system connector fixtures

Provenance matters here — read before trusting a green test.

| file | provenance |
|---|---|
| `df-kP.txt` | **Captured** from `df -kP` on the Linux container this was developed in. |
| `ps-comm.txt` | **Captured** from `ps -eo comm,pcpu,pmem,rss --sort=-pcpu`. |
| `df-edge.txt` | **Hand-written.** Edge cases a normal capture does not contain: spaces in device and mount names, a negative `Available` column (root-reserved blocks), pseudo filesystems that must be filtered, a duplicate mount. |
| `nvidia-smi.txt` | **Hand-written from the documented `--format=csv,noheader,nounits` output shape — NOT captured from a real GPU.** No NVIDIA device was available. It proves the parser handles the documented format, including `[N/A]` / `[Not Supported]` cells and a second GPU. |

## A note on GPUs, because the original plan got this wrong

PLAN.md used to say the target machine was a "Ryzen 5 / RTX 3070". **It is not.** The
machine this dashboard is for is a Lenovo Yoga with **AMD** graphics and no NVIDIA
hardware at all. That mistake had a real consequence: `system.gpu` only knew how to call
`nvidia-smi`, so on the actual target it threw, fell back to the sample, and displayed
"NVIDIA GeForce RTX 3070" — hardware the owner does not own.

`system.gpu` is now vendor-aware and reads AMD/Intel GPUs from DRM sysfs. There is no
sysfs fixture *file* here because that path is a directory tree, not one command's stdout:
`server.test.ts` builds a fake `/sys/class/drm` tree in a temp dir instead (see
`describe('readDrmGpus')`), which covers card discovery, hwmon lookup and absent files.

If you ever have real hardware to hand, capturing its output is still worth doing:

```
# NVIDIA
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,fan.speed --format=csv,noheader,nounits

# AMD / Intel — dump what the kernel actually exposes, and compare against the parser
grep -r . /sys/class/drm/card*/device/{vendor,uevent,gpu_busy_percent,mem_info_vram_*} 2>/dev/null
grep -r . /sys/class/drm/card*/device/hwmon/hwmon*/{temp1_input,power1_*,pwm1,pwm1_max} 2>/dev/null
```
