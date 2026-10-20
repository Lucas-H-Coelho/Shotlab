import os
import pytest
import asyncio

TEST_DB = "/tmp/shotlab_test.db"
os.environ["SHOTLAB_DB_PATH"] = TEST_DB

from db.database import init_db

@pytest.fixture(autouse=True, scope="function")
def setup_test_db():
    if os.path.exists(TEST_DB):
        try:
            os.remove(TEST_DB)
        except Exception:
            pass
    asyncio.run(init_db())
    yield
    if os.path.exists(TEST_DB):
        try:
            os.remove(TEST_DB)
        except Exception:
            pass
