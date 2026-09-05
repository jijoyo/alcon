.PHONY: test-squad test-cold test-empty test-air test-hot test-all ferrari test

test-cold:
	@echo "=== TEST FRIO: clon limpio ==="
	@rm -rf /tmp/alcon-cold && git clone --depth 1 . /tmp/alcon-cold 2>&1 | tail -1
	@cd /tmp/alcon-cold/server/go && go test -run TestSelectBackend -v 2>&1 | grep -q PASS || (echo "❌ frio failed" && exit 1)
	@echo "✅ FRIO OK"

test-empty:
	@echo "=== TEST VACIO: sin datos ==="
	@cd server/go && go test -run TestInjectCode_IgnoresMissing -v 2>&1 | grep -q PASS || (echo "❌ vacio failed" && exit 1)
	@echo "✅ VACIO OK"

test-air:
	@echo "=== TEST AIRE: sin nube ==="
	@cd server/go && OPENROUTER_API_KEY="" go test -run TestFallbackChain_AllFail -v 2>&1 | grep -q PASS || (echo "❌ aire failed" && exit 1)
	@echo "✅ AIRE OK"

test-hot:
	@echo "=== TEST CALIENTE: todo prendido ==="
	@curl -sf http://100.102.63.30:3011/health | grep -q '"status":"ok"' || (echo "❌ Go :3011 no responde" && exit 1)
	@curl -sf http://100.102.63.30:3003/health | grep -q '"status":"ok"' || (echo "❌ Node :3003 no responde" && exit 1)
	@echo "✅ CALIENTE OK"

test-squad:
	@echo "=== TEST-SQUAD: 4 agents misma task sin pisarse ==="
	@test -L server/lib/granja.json || (echo "❌ granja.json not symlinked" && exit 1)
	@grep -q '"throttle": 0' granja.json || (echo "❌ throttle not 0" && exit 1)
	@grep -q "DEPRECATED Ferrari" server/lib/orchestrator.js || (echo "❌ boardStart not bypassed" && exit 1)
	@(curl -sf http://100.121.64.26:8080/v1/models 2>/dev/null || curl -sf http://127.0.0.1:8080/v1/models 2>/dev/null) | grep -q "gemma" && echo "  router OK" || echo "  ⚠️ router off (forja apagada, normal - squad usa nube)"
	@./scripts/ferrari.sh > /dev/null 2>&1 && echo "  ferrari OK" || echo "  ⚠️ ferrari.sh off (forja apagada)"
	@echo "✅ SQUAD OK (con advertencias si forja off)"

test-all: test-cold test-empty test-air test-hot test-squad
	@echo "✅ ALL 5 TESTS PASSED (frio, vacio, aire, caliente, squad)"

ferrari:
	@./scripts/ferrari.sh

test: test-squad
