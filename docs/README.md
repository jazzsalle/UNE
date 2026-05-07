# /docs — POC 역설계 산출 문서

본 디렉터리는 LH2 인수기지 디지털 트윈 PoC를 역설계하여 작성한 본개발 진입용 기준 문서를 포함한다. 4개 외부기관(KOGAS, KGS, KETI, 세이프티아)과 운영기관 검토 → 모니터링 데이터·상세 기능 확정 → 본개발 착수의 흐름에 사용된다.

## 문서 목록

| 파일 | 용도 | 검토 대상 |
|------|------|---------|
| `REQ_SPEC_LH2_DigitalTwin_v1.0.docx` | 상세 요구사항 정의서. 8개 모드, 67개 API, 16개 DB 모델, 비기능 요구사항, 본개발 확정 필요 항목 정리 | 운영기관 + 4개 기관 |
| `IFD_LH2_DigitalTwin_v1.0.docx` | 기관별 데이터 인터페이스 정의서. KOGAS/KGS/KETI/세이프티아별 endpoint·요청/응답 스키마·합의 체크리스트 | 4개 기관 |
| `build_req_spec.py` | REQ_SPEC docx 생성 스크립트 (재현 가능) | 작성자 |
| `build_ifd.py` | IFD docx 생성 스크립트 (재현 가능) | 작성자 |

## 작성 근거

- `CLAUDE.md` — POC 단일 개발 가이드
- `apps/api/src/**` — Express + Prisma 백엔드 구현
- `apps/web/src/**` — Next.js 14 + Three.js 프론트엔드 구현
- `seed/*.json` — 28개 PoC 시드 데이터

## 재생성 방법

```bash
pip install python-docx
cd docs
python3 build_req_spec.py
python3 build_ifd.py
```
