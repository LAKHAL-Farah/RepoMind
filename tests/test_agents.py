import pytest
from unittest.mock import patch, MagicMock
from agents.orchestrator import route_question
from analyzers.base_analyzer import Finding


class DummyParsed:
	pass


@patch("agents.security_agent.OpenAI")
@patch("agents.devops_agent.OpenAI")
@patch("agents.architecture_agent.search_chunks", return_value=[])
@patch("agents.architecture_agent.get_all_apis", return_value=[])
@patch("agents.architecture_agent.get_all_services", return_value=[])
@patch("agents.architecture_agent.OpenAI")
def test_routing_and_agent_answers(mock_arch, mock_services, mock_apis, mock_search, mock_devops, mock_sec):
	# Mock the clients to return a predictable response
	fake_resp = MagicMock()
	fake_choice = MagicMock()
	fake_choice.message.content = "OK"
	fake_resp.choices = [fake_choice]

	for m in (mock_arch, mock_devops, mock_sec):
		instance = m.return_value
		instance.chat.completions.create.return_value = fake_resp

	parsed = DummyParsed()
	findings = [Finding(severity="info", category="security", title="t", description="d", file="f")]

	ans = route_question("Is CORS open?", "repo1", parsed, findings)
	assert isinstance(ans, str) and ans != ""

	ans = route_question("How to deploy docker image?", "repo1", parsed, findings)
	assert isinstance(ans, str) and ans != ""

	ans = route_question("What is the service architecture?", "repo1", parsed, findings)
	assert isinstance(ans, str) and ans != ""
