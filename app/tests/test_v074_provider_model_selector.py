import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from backend import api as api_module
from backend.config import normalize_config


ROOT = Path(__file__).resolve().parents[1]


def make_client(tmp_path: Path):
    app = create_app(db_file=tmp_path / "test.sqlite", config_file=tmp_path / "config.json")
    app.config.update(TESTING=True)
    return app.test_client()


def test_model_candidates_normalize_duplicates_and_keep_provider_scope():
    config = normalize_config(
        {
            "active_provider": "provider_a",
            "providers": {
                "provider_a": {
                    "display_name": "Provider A",
                    "adapter": "openai",
                    "model": "model-a",
                    "model_candidates": [
                        {"id": "model-a", "verified": False},
                        {"id": " model-b ", "verified": False},
                        {"id": "model-b", "verified": True},
                        {"id": "", "verified": True},
                    ],
                },
                "provider_b": {
                    "display_name": "Provider B",
                    "adapter": "openai",
                    "model": "model-c",
                    "model_candidates": [{"id": "model-d", "verified": True}],
                },
            },
        }
    )

    assert config["providers"]["provider_a"]["model_candidates"] == [
        {"id": "model-a", "verified": False},
        {"id": "model-b", "verified": True},
    ]
    assert config["providers"]["provider_b"]["model_candidates"] == [
        {"id": "model-c", "verified": False},
        {"id": "model-d", "verified": True},
    ]


def test_legacy_provider_config_keeps_current_model_as_pending_candidate():
    config = normalize_config(
        {
            "providers": {
                "legacy_provider": {
                    "display_name": "Legacy Provider",
                    "adapter": "openai",
                    "model": "legacy-model-id",
                }
            }
        }
    )

    assert config["providers"]["legacy_provider"]["model"] == "legacy-model-id"
    assert config["providers"]["legacy_provider"]["model_candidates"] == [
        {"id": "legacy-model-id", "verified": False}
    ]


def test_provider_model_api_adds_selects_deletes_and_survives_settings_save(tmp_path):
    client = make_client(tmp_path)
    settings = client.get("/api/settings").get_json()["settings"]
    provider_key = settings["active_provider"]
    original_model = settings["providers"][provider_key]["model"]
    candidate_model = "v074-model-selector-test"

    added = client.post(
        "/api/provider-models",
        json={
            "action": "add",
            "provider_key": provider_key,
            "model": f"  {candidate_model}  ",
        },
    )
    assert added.status_code == 200
    added_provider = added.get_json()["settings"]["providers"][provider_key]
    assert added_provider["model"] == original_model
    assert {"id": candidate_model, "verified": False} in added_provider["model_candidates"]

    duplicate = client.post(
        "/api/provider-models",
        json={"action": "add", "provider_key": provider_key, "model": candidate_model},
    )
    assert duplicate.status_code == 200
    assert duplicate.get_json()["changed"] is False
    assert sum(
        item["id"] == candidate_model
        for item in duplicate.get_json()["settings"]["providers"][provider_key]["model_candidates"]
    ) == 1

    selected = client.post(
        "/api/provider-models",
        json={"action": "select", "provider_key": provider_key, "model": candidate_model},
    )
    assert selected.status_code == 200
    assert selected.get_json()["settings"]["providers"][provider_key]["model"] == candidate_model

    cannot_delete_current = client.post(
        "/api/provider-models",
        json={"action": "delete", "provider_key": provider_key, "model": candidate_model},
    )
    assert cannot_delete_current.status_code == 409

    current_settings = client.get("/api/settings").get_json()["settings"]
    saved = client.put("/api/settings", json=current_settings)
    assert saved.status_code == 200
    assert {"id": candidate_model, "verified": False} in (
        saved.get_json()["settings"]["providers"][provider_key]["model_candidates"]
    )

    restored = client.post(
        "/api/provider-models",
        json={"action": "select", "provider_key": provider_key, "model": original_model},
    )
    assert restored.status_code == 200
    deleted = client.post(
        "/api/provider-models",
        json={"action": "delete", "provider_key": provider_key, "model": candidate_model},
    )
    assert deleted.status_code == 200
    refreshed = client.get("/api/settings").get_json()["settings"]
    assert all(
        item["id"] != candidate_model
        for item in refreshed["providers"][provider_key]["model_candidates"]
    )


def test_successful_model_verification_is_provider_scoped_and_persistent(tmp_path):
    client = make_client(tmp_path)
    settings = client.get("/api/settings").get_json()["settings"]
    provider_a = settings["active_provider"]
    shared_model = "v074-shared-model-test"
    provider_b = "v074_test_provider_b"
    second_provider = dict(settings["providers"][provider_a])
    second_provider.update(
        {
            "display_name": "V0.74 Test Provider B",
            "model": "second-provider-model",
            "model_candidates": [
                {"id": shared_model, "verified": False},
                {"id": "second-provider-model", "verified": False},
            ],
        }
    )
    settings["providers"][provider_b] = second_provider
    saved = client.put("/api/settings", json=settings)
    assert saved.status_code == 200
    added_to_b = client.post(
        "/api/provider-models",
        json={"action": "add", "provider_key": provider_b, "model": shared_model},
    )
    assert added_to_b.status_code == 200

    added = client.post(
        "/api/provider-models",
        json={"action": "add", "provider_key": provider_a, "model": shared_model},
    )
    assert added.status_code == 200
    with client.application.app_context():
        api_module.record_successful_provider_model(provider_a, shared_model)

    refreshed = client.get("/api/settings").get_json()["settings"]
    assert {"id": shared_model, "verified": True} in (
        refreshed["providers"][provider_a]["model_candidates"]
    )
    assert {"id": shared_model, "verified": False} in (
        refreshed["providers"][provider_b]["model_candidates"]
    )


def test_deleted_model_is_not_resurrected_by_an_in_flight_success(tmp_path):
    client = make_client(tmp_path)
    settings = client.get("/api/settings").get_json()["settings"]
    provider_key = settings["active_provider"]
    original_model = settings["providers"][provider_key]["model"]
    candidate_model = "v074-deleted-in-flight-model"

    assert client.post(
        "/api/provider-models",
        json={"action": "add", "provider_key": provider_key, "model": candidate_model},
    ).status_code == 200
    assert client.post(
        "/api/provider-models",
        json={"action": "select", "provider_key": provider_key, "model": candidate_model},
    ).status_code == 200
    assert client.post(
        "/api/provider-models",
        json={"action": "select", "provider_key": provider_key, "model": original_model},
    ).status_code == 200
    assert client.post(
        "/api/provider-models",
        json={"action": "delete", "provider_key": provider_key, "model": candidate_model},
    ).status_code == 200

    with client.application.app_context():
        api_module.record_successful_provider_model(provider_key, candidate_model)

    refreshed = client.get("/api/settings").get_json()["settings"]
    assert all(
        item["id"] != candidate_model
        for item in refreshed["providers"][provider_key]["model_candidates"]
    )



def test_settings_save_cannot_forge_verification_or_copy_it_to_new_provider(tmp_path):
    client = make_client(tmp_path)
    settings = client.get("/api/settings").get_json()["settings"]
    provider_key = settings["active_provider"]
    verified_model = "v074-settings-verified-model"
    forged_model = "v074-forged-verified-model"
    new_provider_key = "v074_cloned_provider"

    assert client.post(
        "/api/provider-models",
        json={"action": "add", "provider_key": provider_key, "model": verified_model},
    ).status_code == 200
    with client.application.app_context():
        api_module.record_successful_provider_model(provider_key, verified_model)

    settings = client.get("/api/settings").get_json()["settings"]
    provider = settings["providers"][provider_key]
    for candidate in provider["model_candidates"]:
        if candidate["id"] == verified_model:
            candidate["verified"] = False
    provider["model_candidates"].append({"id": forged_model, "verified": True})
    settings["providers"][new_provider_key] = {
        **provider,
        "display_name": "V0.74 Cloned Provider",
    }

    saved = client.put("/api/settings", json=settings)
    assert saved.status_code == 200
    providers = saved.get_json()["settings"]["providers"]
    assert {"id": verified_model, "verified": True} in providers[provider_key]["model_candidates"]
    assert all(item["id"] != forged_model for item in providers[provider_key]["model_candidates"])
    assert all(item["id"] != verified_model for item in providers[new_provider_key]["model_candidates"])
    assert {"id": providers[new_provider_key]["model"], "verified": False} in (
        providers[new_provider_key]["model_candidates"]
    )



def test_frontend_model_selector_and_compact_tag_row_are_wired():
    render_instance = (ROOT / "frontend" / "js" / "render-instance.js").read_text(encoding="utf-8")
    actions_manager = (ROOT / "frontend" / "js" / "actions-manager.js").read_text(encoding="utf-8")
    events = (ROOT / "frontend" / "js" / "events.js").read_text(encoding="utf-8")
    css = (ROOT / "frontend" / "css" / "06-instance-card.css").read_text(encoding="utf-8")

    assert 'data-action="toggle-instance-model-dropdown"' in render_instance
    assert 'data-action="add-provider-model-candidate"' in render_instance
    assert 'data-action="select-provider-model-candidate"' in render_instance
    assert 'data-action="delete-provider-model-candidate"' in render_instance
    assert "function renderInstanceModelSelector" in render_instance
    assert "function toggleInstanceModelDropdown" in actions_manager
    assert "function addProviderModelCandidate" in actions_manager
    assert "function selectProviderModelCandidate" in actions_manager
    assert "function deleteProviderModelCandidate" in actions_manager
    global_exports = actions_manager[actions_manager.rfind("Object.assign(globalThis") :]
    for name in (
        "toggleInstanceModelDropdown",
        "addProviderModelCandidate",
        "selectProviderModelCandidate",
        "deleteProviderModelCandidate",
    ):
        assert name in global_exports
    assert 'action === "toggle-instance-model-dropdown"' in events
    assert 'action === "add-provider-model-candidate"' in events
    assert 'action === "select-provider-model-candidate"' in events
    assert 'action === "delete-provider-model-candidate"' in events
    assert ".instance-card .detail-stack" in css
    assert ".instance-inline-actions > .tag-selector" in css
    assert ".instance-model-dropdown" in css

    card = render_instance[
        render_instance.find('      <div class="field record-detail">') :
        render_instance.find('      <div class="record-actions instance-actions">')
    ]
    assert card.find("renderProviderSourceRow") < card.find("renderInstanceModelSelector")
    assert card.find("renderInstanceModelSelector") < card.find("${inlineActions}")

    inline_actions = render_instance[
        render_instance.find("const inlineActions") :
        render_instance.find("\n\n  return `", render_instance.find("const inlineActions"))
    ]
    assert inline_actions.find("${tagSelector}") < inline_actions.find("${clearTagsAction}")
    assert inline_actions.find("${clearTagsAction}") < inline_actions.find('data-action="bring-instance-to-operation"')
