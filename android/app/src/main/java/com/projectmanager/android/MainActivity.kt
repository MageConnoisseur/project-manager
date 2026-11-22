package com.projectmanager.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.projectmanager.android.ui.AppViewModel
import com.projectmanager.android.ui.ProjectApp
import com.projectmanager.android.ui.ProjectManagerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ProjectManagerTheme {
                val viewModel: AppViewModel = viewModel()
                ProjectApp(viewModel)
            }
        }
    }
}
