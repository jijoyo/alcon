.PHONY: test-squad ferrari test

test-squad:
	@echo "=== TEST-SQUAD: 4 agents misma task sin pisarse ==="
	@test -L server/lib/granja.json || (echo "❌ granja.json not symlinked" && exit 1)
	@grep -q '"throttle": 0' granja.json || (echo "❌ throttle not 0" && exit 1)
	@grep -q "DEPRECATED Ferrari" server/lib/orchestrator.js || (echo "❌ boardStart not bypassed" && exit 1)
	@curl -sf http://127.0.0.1:8080/v1/models | grep -q "gemma4-12b" || (echo "❌ router not responding" && exit 1)
	@./scripts/ferrari.sh > /dev/null 2>&1 || (echo "❌ ferrari.sh failed" && exit 1)
	@echo "✅ ALL TESTS PASSED"

ferrari:
	@./scripts/ferrari.sh

test: test-squad
