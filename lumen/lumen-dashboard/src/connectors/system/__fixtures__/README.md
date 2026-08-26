# system connector fixtures

Provenance matters here — read before trusting a green test.

| file | provenance |
|---|---|
| `df-kP.txt` | **Captured** from `df -kP` on the Linux container this was developed in. |
| `ps-comm.txt` | **Captured** from `ps -eo comm,pcpu,pmem,rss --sort=-pcpu`. |
| `df-edge.txt` | **Hand-written.** Edge cases a normal capture does not contain: spaces in device and mount names, a negative `Available` column (root-reserved blocks), pseudo filesystems that must be filtered, a duplicate mount. |
| `nvidia-smi.txt` | **Hand-written from the documented `--format=csv,noheader,nounits` output shape — NOT captured from a real GPU.** No NVIDIA device was available. It therefore proves the parser handles the format as documented, including `[N/A]` / `[Not Supported]` cells and a second GPU; it does **not** discharge PLAN.md Phase 1 step 3, which explicitly asks for verification against real `nvidia-smi` output on the target machine (Ryzen 5 / RTX 3070). That box stays unchecked. |

When you do get to a real NVIDIA machine: run

```
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,fan.speed --format=csv,noheader,nounits
```

replace `nvidia-smi.txt` with the real output, re-run `npm test`, and only then check
Phase 1 step 3 off.
