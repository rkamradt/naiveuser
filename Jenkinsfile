pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
              withDockerRegistry([ credentialsId: "rlkamradt-docker", url: "" ]) {
                sh 'docker build --tag rlkamradt/naivecoin .'
                sh 'docker push rlkamradt/naivecoin'
              }
            }
        }
    }
}
