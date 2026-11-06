"""Create labeled-in-manifest PNG placeholders without overwriting artwork."""
from pathlib import Path
import json
import struct
import zlib
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'pixel'
ASSETS = [
    ('map/tiles/grass-01.png', 32, 32, '풀 바닥 기본', '전체 불투명, 사방 반복 가능', '#45664a'),
    ('map/tiles/grass-02.png', 32, 32, '풀 바닥 변형', '전체 불투명, 기본 풀과 연결', '#507151'),
    ('map/tiles/dirt-path.png', 32, 32, '흙길 바닥', '전체 불투명, 사방 반복 가능', '#8b7352'),
    ('map/tiles/rock-ground.png', 32, 32, '바위 지대 바닥', '전체 불투명, 사방 반복 가능', '#65746b'),
    ('map/tiles/forest-floor.png', 32, 32, '맵 밖 짙은 숲 바닥', '전체 불투명, 사방 반복 가능', '#233b2c'),
    ('map/tiles/path-edges.png', 96, 96, '풀과 흙길 연결 타일 9종', '32px 타일 3×3: 좌상·상·우상 / 좌·중앙·우 / 좌하·하·우하', '#9b845e'),
    ('map/tiles/field-edges.png', 96, 96, '필드와 외곽 숲 연결 타일 9종', '32px 타일 3×3, 바깥쪽은 투명', '#40563b'),
    ('map/objects/tree-01.png', 64, 96, '필드 나무 기본', '투명 배경, 발 기준 (32, 92)', '#46764d'),
    ('map/objects/tree-02.png', 64, 96, '필드 나무 변형', '투명 배경, 발 기준 (32, 92)', '#58834d'),
    ('map/objects/tree-dense.png', 64, 96, '외곽 우거진 숲 나무', '투명 배경, 발 기준 (32, 92), 겹쳐 배치', '#25482e'),
    ('map/objects/rock-01.png', 48, 32, '바위 기본', '투명 배경, 발 기준 (24, 28)', '#7d8b8b'),
    ('map/objects/rock-02.png', 48, 32, '바위 변형', '투명 배경, 발 기준 (24, 28)', '#626e76'),
    ('map/objects/grass-tuft.png', 16, 16, '풀 덤불 장식', '투명 배경', '#638751'),
    ('map/objects/flowers.png', 16, 16, '작은 꽃 장식', '투명 배경', '#c6ae7b'),
    ('map/objects/shadow.png', 32, 16, '발밑 그림자', '투명 배경, 반투명 짙은색 납작한 형태', '#23372d'),
    ('ui/panels/panel-default.png', 48, 48, '상태창·사이드 패널', '9-slice: 가장자리 16px, 투명 모서리', '#263a50'),
    ('ui/panels/panel-modal.png', 48, 48, '여관·상점·장비·보스 팝업', '9-slice: 가장자리 16px, 투명 모서리', '#35445a'),
    ('ui/panels/panel-tooltip.png', 32, 32, 'NPC·입구 호버 말풍선', '9-slice: 가장자리 8px', '#253341'),
    ('ui/panels/minimap-frame.png', 48, 48, '미니맵 테두리', '9-slice: 가장자리 16px, 중앙 투명', '#756346'),
    ('ui/buttons/button-normal.png', 48, 24, '기본 버튼', '9-slice: 가장자리 8px, 글자 제외', '#526b8b'),
    ('ui/buttons/button-hover.png', 48, 24, '버튼 마우스 올림·키보드 포커스', '기본 버튼과 같은 외곽, 글자 제외', '#6f91ab'),
    ('ui/buttons/button-pressed.png', 48, 24, '버튼 누름', '기본 버튼과 같은 외곽, 글자 제외', '#354b69'),
    ('ui/buttons/button-disabled.png', 48, 24, '버튼 비활성', '기본 버튼과 같은 외곽, 글자 제외', '#50565e'),
    ('ui/buttons/button-danger.png', 48, 24, '새 게임 등 위험 동작 버튼', '9-slice: 가장자리 8px, 글자 제외', '#914e57'),
    ('ui/icons/close.png', 16, 16, '팝업 닫기 ×', '투명 배경, 아이콘만', '#dbd8c3'),
    ('ui/icons/back.png', 16, 16, '뒤로가기 화살표', '투명 배경, 아이콘만', '#dbd8c3'),
    ('ui/icons/gold.png', 16, 16, '골드', '투명 배경', '#d5ad54'),
    ('ui/icons/heart.png', 16, 16, '체력', '투명 배경', '#d66e75'),
    ('ui/bars/bar-frame.png', 48, 12, '체력·보스 체력바 테두리', '9-slice: 가장자리 4px, 중앙 투명', '#8f8567'),
    ('ui/bars/hp-fill.png', 8, 4, '캐릭터 체력바 채움', '가로 반복 가능', '#78b980'),
    ('ui/bars/boss-hp-fill.png', 8, 4, '보스 체력바 채움', '가로 반복 가능', '#d57479'),
    ('ui/bars/bar-empty.png', 8, 4, '체력바 빈 배경', '가로 반복 가능', '#32313d'),
    ('map/tiles/path-inner-corners.png', 64, 64, '흙길 오목 모서리 4종', '32px 타일 2×2: 좌상·우상 / 좌하·우하, 투명 배경', '#8b7352'),
    ('map/tiles/field-inner-corners.png', 64, 64, '숲 경계 오목 모서리 4종', '32px 타일 2×2, 불규칙 외곽 안쪽 연결, 투명 배경', '#40563b'),
    ('inn/tiles/wood-floor.png', 32, 32, '여관 나무 바닥', '불투명, 사방 반복 가능', '#79573c'),
    ('inn/tiles/wall.png', 32, 48, '여관 뒤쪽 벽', '불투명, 가로 반복 가능, 위쪽 벽과 아래 걸레받이', '#48404b'),
    ('inn/objects/counter.png', 96, 48, '여관주인 카운터', '투명 배경, 발 기준 (48,44)', '#986c41'),
    ('inn/objects/bed.png', 48, 64, '휴식용 침대', '투명 배경, 발 기준 (24,60)', '#526983'),
    ('inn/objects/forge.png', 64, 64, '대장장이 화로', '투명 배경, 발 기준 (32,60), 불꽃은 별도 효과', '#68616b'),
    ('inn/objects/anvil.png', 32, 32, '대장장이 모루', '투명 배경, 발 기준 (16,28)', '#71818b'),
    ('inn/objects/potion-shelf.png', 64, 48, '상점 포션 진열대', '투명 배경, 발 기준 (32,44)', '#846144'),
    ('inn/objects/door.png', 48, 48, '사냥터로 나가는 입구', '투명 배경, 발 기준 (24,44), 글자 제외', '#bfa16c'),
    ('inn/effects/door-light.png', 96, 80, '입구에서 안쪽으로 퍼지는 빛', '투명 배경, 반투명 금빛, 빛이 아래쪽 입구에서 위로 넓어짐', '#ead59b'),
    ('inn/effects/forge-fire.png', 64, 32, '화로 불꽃 애니메이션', '투명 배경, 16×32px 프레임 4개 가로 배열', '#f4a653'),
    ('inn/npcs/innkeeper.png', 32, 48, '여관주인 NPC', '투명 배경, 발 기준 (16,44), 이름·말풍선 제외', '#d4c3a2'),
    ('inn/npcs/blacksmith.png', 32, 48, '대장장이 NPC', '투명 배경, 발 기준 (16,44), 이름·말풍선 제외', '#765044'),
    ('inn/npcs/potion-merchant.png', 32, 48, '포션 상점 NPC', '투명 배경, 발 기준 (16,44), 이름·말풍선 제외', '#658b68'),
    ('ui/icons/settings.png', 16, 16, '오른쪽 위 설정 톱니바퀴', '투명 배경, 저장·새 게임은 공통 버튼 재사용', '#e8dfc4'),
    ('ui/icons/chevron-down.png', 8, 8, '스탯·성장창 펼치기', '투명 배경', '#e8dfc4'),
    ('ui/icons/chevron-up.png', 8, 8, '스탯·성장창 접기', '투명 배경', '#e8dfc4'),
    ('ui/icons/attack.png', 16, 16, '기본 공격력 아이콘', '투명 배경', '#d5bd91'),
    ('ui/icons/attack-speed.png', 16, 16, '공격 속도 아이콘', '투명 배경', '#91b3d5'),
    ('ui/icons/critical-chance.png', 16, 16, '치명타 확률 아이콘', '투명 배경', '#d5a391'),
    ('ui/icons/critical-damage.png', 16, 16, '치명타 피해 아이콘', '투명 배경', '#d58b91'),
    ('ui/icons/evasion.png', 16, 16, '민첩성·회피율 아이콘', '투명 배경, 이동 속도 아이콘 아님', '#91d5b5'),
    ('ui/icons/threat.png', 16, 16, '몬스터 위협도 아이콘', '투명 배경', '#d5896d'),
    ('ui/icons/clock.png', 16, 16, '사냥 시간·여관 회복 타이머', '투명 배경', '#c7c3a1'),
    ('ui/icons/minimap-player.png', 8, 8, '미니맵 현재 위치 표시', '투명 배경', '#ffd67b'),
    ('ui/panels/item-slot.png', 32, 32, '장비·포션 인벤토리 슬롯', '9-slice: 가장자리 4px, 중앙 어두운 바탕', '#3b4954'),
    ('ui/panels/item-slot-selected.png', 32, 32, '장착·선택된 아이템 슬롯', '9-slice: 가장자리 4px, 기본 슬롯과 동일 외곽', '#bb9d60'),
    ('ui/panels/input-field.png', 48, 24, '첫 진입 닉네임 입력창', '9-slice: 가장자리 8px, 글자·커서 제외', '#344a59'),
    ('ui/panels/tooltip-tail.png', 8, 8, '말풍선 아래쪽 꼬리', '투명 배경, panel-tooltip과 색상 통일', '#d5bd91'),
    ('items/chest-closed.png', 24, 24, '일반 필드에 떨어진 장비상자', '투명 배경, 발 기준 (12,22)', '#ab7d42'),
    ('items/chest-open.png', 24, 24, '획득 시 열린 장비상자', '투명 배경, 발 기준 (12,22)', '#d5ad54'),
    ('items/potions.png', 96, 16, '상점·인벤토리 포션 6등급', '투명 배경, 16×16px 6칸: common/rare/epic/heroic/legendary/mythic', '#a175ad'),
    ('items/equipment.png', 192, 24, '장비 아이콘 8종', '투명 배경, 24×24px 8칸: 검/활/지팡이/투구/갑옷/장갑/신발/대검', '#95aab6'),
    ('boss/map/background.png', 320, 192, '횡스크롤 보스전 먼 배경', '불투명, 가로 반복 가능, 캐릭터·보스 제외', '#252d47'),
    ('boss/map/ground.png', 32, 32, '보스전 발판 바닥', '불투명, 가로 반복 가능, 윗면과 앞면 포함', '#685344'),
    ('boss/map/pillar.png', 48, 128, '보스전 중간 거리 기둥', '투명 배경, 패럴랙스 배경 장식', '#414b63'),
    ('boss/effects/slam-warning.png', 96, 16, '내려찍기 바닥 경고', '투명 배경, 빨간 타격 범위, 피해 판정은 코드', '#df735e'),
    ('boss/effects/slam-fist.png', 64, 96, '내려찍는 거대한 주먹', '투명 배경, 아래쪽이 주먹 끝, 보스 몸체와 별개', '#ba6e79'),
    ('boss/effects/slam-impact.png', 128, 32, '내려찍기 충격파', '투명 배경, 먼지·돌 파편', '#e0bd87'),
]


def png_bytes(width, height, color, transparent):
    rgb = tuple(bytes.fromhex(color.lstrip('#')))
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            border = x in (0, width - 1) or y in (0, height - 1)
            if transparent and (x < 2 or y < 2 or x >= width - 2 or y >= height - 2):
                pixel = (0, 0, 0, 0)
            elif border or x == y or x == width - y - 1:
                pixel = (235, 206, 151, 255)
            else:
                shade = 14 if (x // 4 + y // 4) % 2 else -14
                pixel = (*[max(0, min(255, c + shade)) for c in rgb], 255)
            row.extend(pixel)
        rows.append(b'\x00' + row)
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')


ROOT.mkdir(parents=True, exist_ok=True)
previous_manifest = {}
if (ROOT / 'manifest.json').exists():
    previous_manifest = {item['path']: item for item in json.loads((ROOT / 'manifest.json').read_text())}
manifest = []
for name, width, height, label, notes, color in ASSETS:
    destination = ROOT / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(png_bytes(width, height, color, '투명' in notes))
    category = '일반 필드' if name.startswith('map/') else '여관' if name.startswith('inn/') else '아이템' if name.startswith('items/') else '보스 전장' if name.startswith('boss/') else '공통 UI'
    optional = name in ['ui/icons/back.png', 'map/objects/flowers.png', 'map/objects/grass-tuft.png', 'map/objects/tree-02.png', 'map/objects/rock-02.png'] or name.startswith('ui/icons/') and name not in ['ui/icons/settings.png', 'ui/icons/close.png', 'ui/icons/chevron-down.png', 'ui/icons/chevron-up.png']
    manifest.append(dict(path=name, width=width, height=height, label=label, notes=notes, category=category, priority='선택' if optional else '필수', placeholder=previous_manifest.get(name, {}).get('placeholder', True)))
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
sections = []
for category in ['일반 필드', '여관', '공통 UI', '아이템', '보스 전장']:
    group = [item for item in manifest if item['category'] == category]
    rows = '\n'.join(f'| `{a["path"]}` | {a["width"]}×{a["height"]} | {a["priority"]} | {a["label"]} | {a["notes"]} |' for a in group)
    sections.append(f'## {category} ({len(group)}개)\n\n| 파일 | 원본 크기(px) | 구분 | 용도 | 제작 조건 |\n|---|---|---|---|---|\n' + rows)
intro = """# 현재 화면 기준 도트 에셋 제작 목록

전체 화면 사냥터, 불규칙 숲 경계, 여관 내부 NPC, 성장·스탯 접기, 설정 팝업을 기준으로 정리했습니다.
PNG는 모두 **체크무늬 더미**이며 아직 게임에 연결하지 않았습니다. 같은 경로에 완성 PNG를 교체한 뒤 적용합니다.
기존 PNG는 재생성 시 덮어쓰지 않습니다. 이 목록은 파일명·원본 크기·제작 조건을 지정하는 제작 명세입니다.

## 화면별 재사용 기준

- 사냥터: 바닥·숲 경계·나무·바위·장비상자. 미니맵의 지형은 코드로 그리며 별도 전체 맵 이미지는 필요 없습니다.
- 여관: 나무 바닥과 벽 위에 가구·NPC·빛 효과를 개별 배치합니다. NPC를 버튼 그림에 넣지 않습니다.
- 여관주인 → 인벤토리, 대장장이 → 무기 강화, 상점 주인 → 포션 전용 상점.
- 입구에는 빛 효과와 호버 말풍선을 사용합니다. 별도 사냥터 복귀 버튼은 제작하지 않습니다.
- 성장 강화·여관·보스·저장·새 게임·닉네임 확인 버튼은 공통 버튼을 재사용합니다.
- 스탯 보기·성장창 접기는 공통 버튼/패널과 위·아래 화살표를 재사용합니다.
- 설정 아이콘은 오른쪽 위, 닉네임·HP는 왼쪽 아래, 맵 이름은 오른쪽 아래입니다.
- 인벤토리·대장장이·포션 상점·설정·닉네임·직업 선택·보스 안내는 공통 팝업 프레임을 재사용합니다.
- 기존 back.png는 선택 예비 파일입니다. 현재 여관에는 사용하지 않습니다.

## 제작 규격

- 크기는 확대 전 원본입니다. PNG/RGBA, 픽셀 경계를 선명하게 제작하고 흐림·안티앨리어싱을 사용하지 않습니다.
- 이름·수치·비용·확률·맵 이름·말풍선 문구는 코드의 텍스트입니다. 이미지에 넣지 않습니다.
- 딤 처리, 호버 강조, 포커스, 미니맵 지형·시야 사각형, 피해 숫자, 빛의 맥동은 코드로 처리합니다.
- 9-slice는 가장자리 지정 폭을 보존하고 가운데를 확장합니다. 기본 버튼 48×24px의 가장자리는 8px입니다.
- 바닥 32×32px는 평평한 위쪽 면으로, 사물은 위와 앞면이 보이는 2.5D로 만듭니다. 바닥의 세로 압축은 렌더러에서 한 번만 처리합니다.
- 발 기준 좌표는 이미지 왼쪽 위가 (0,0)이며 Y 정렬 기준입니다. 사물 이미지는 세로 압축하지 않습니다.
- 연결 타일은 3×3 기본 세트와 2×2 오목 모서리 세트를 함께 제작해 불규칙 지형에 대응합니다.
- 애니메이션/아이콘 시트는 기재한 칸 크기·순서를 지킵니다. 투명 여백도 원본 크기에 포함됩니다.
- 필수/선택은 완성 목표 기준입니다. 기존 더미는 참고용이며 실제 투명 영역·9-slice·실루엣을 완성 아트로 교체해야 합니다.
- 한글 픽셀 폰트는 허가된 WOFF2를 별도로 준비합니다. 가짜 폰트 파일은 생성하지 않습니다.
- 플레이어·일반 몬스터·보스 몸체의 이동/공격 스프라이트는 별도 캐릭터 제작 단계이며 이번 맵·UI 목록에 포함하지 않습니다.

## 권장 제작 순서

1. 풀·흙길·외곽 숲·경계 타일과 나무
2. 공통 패널·버튼 4상태·설정/닫기/펼치기 아이콘·HP바
3. 여관 바닥·벽·가구·NPC 3명·입구 빛·말풍선
4. 장비상자·포션/장비 아이콘과 슬롯
5. 보스전 배경·발판·주먹/경고 효과, 선택 장식

[더미 전체 미리보기](preview.html) · [기계 판독용 목록](manifest.json)

"""
(ROOT / 'README.md').write_text(intro + '\n\n'.join(sections) + '\n', encoding='utf-8')
cards = ''.join(f'<article data-category="{escape(a["category"])}"><div class="image"><img src="{escape(a["path"])}" width="{a["width"]*2}" height="{a["height"]*2}" alt="{escape(a["label"])} 더미"></div><p>{escape(a["category"])} · {escape(a["priority"])}</p><h2>{escape(a["label"])}</h2><code>{escape(a["path"])}</code><p>{a["width"]} × {a["height"]} px</p><p>{escape(a["notes"])}</p></article>' for a in manifest)
(ROOT / 'preview.html').write_text('''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>도트 에셋 더미 목록</title><style>body{background:#14202b;color:#e6e8dc;font:15px sans-serif;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}article{background:#22323e;padding:16px;border:2px solid #556578;overflow-wrap:anywhere}h2{font-size:17px}.image{height:260px;overflow:auto;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#28333a 0% 25%,#35414a 0% 50%) 0/16px 16px}img{image-rendering:pixelated;max-width:100%;max-height:240px;object-fit:contain}p{color:#bbc7cc}code{font-size:12px}</style><h1>맵·UI 도트 이미지 더미</h1><p>체크무늬는 자리 표시용입니다. 게임에는 아직 적용되지 않았습니다. 표시 크기는 원본의 2배입니다.</p><label>분류 <select id="category"><option value="">전체</option><option>일반 필드</option><option>여관</option><option>공통 UI</option><option>아이템</option><option>보스 전장</option></select></label><main>''' + cards + '</main><script>document.getElementById("category").addEventListener("change",event=>{document.querySelectorAll("article").forEach(card=>{card.hidden=Boolean(event.target.value && card.dataset.category!==event.target.value);});});</script></html>', encoding='utf-8')
print(f'Prepared {len(manifest)} placeholder PNGs, manifest, README, and preview in {ROOT}')
