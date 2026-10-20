import pytest
import asyncio
from db.database import init_db

@pytest.fixture(autouse=True, scope="session")
def setup_test_db():
    asyncio.run(init_db())
