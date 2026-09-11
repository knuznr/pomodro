import pytest
from pomodoro.session import next_break


@pytest.mark.parametrize('completed, expected', [
    (1, 'short'), (2, 'short'), (3, 'short'), (4, 'long'),
    (5, 'short'), (6, 'short'), (8, 'long'), (10, 'short'), (12, 'long'),
])
def test_next_break(completed, expected):
    assert next_break(completed) == expected


@pytest.mark.parametrize('completed', [0, -1])
def test_invalid_session_count(completed):
    with pytest.raises(ValueError):
        next_break(completed)
